import type {
  Arrangement,
  ArrangementFavoritePreferences,
  CourseGroup,
  ResidentCampus,
} from '@/types';
import {
  blockedSlotKey,
  DEFAULT_CUSTOM_SETTINGS,
  type CustomScheduleSettings,
} from './customization';
import { expandWeeks } from './weeks';
import {
  campusVisitsForGroup,
  scoreCampusVisits,
  type CampusVisit,
} from './campusTransfers';
import {
  blockedMinuteIntervalsByDay,
  minuteIntervalsOverlap,
  scheduleSlotMinuteIntervals,
  scheduleSlotOverlapsBlocked,
} from './scheduleTime';

export const ARRANGEMENT_RESULT_LIMIT = 100;

export type ArrangementResultMode = 'recommended' | 'all-conflict-free';

export interface ArrangementEnumerationResult {
  arrangements: Arrangement[];
  conflictFreePreview: Arrangement[];
  totalConflictFreeCount: number;
}

export interface ArrangementEnumerationOptions {
  mode?: ArrangementResultMode;
  diagnostics?: ArrangementSearchDiagnostics;
  favorites?: ArrangementFavoritePreferences;
}

export interface ArrangementRank {
  favoriteArrangement: boolean;
  conflictCount: number;
  favoriteCourseCount: number;
  campusTransitionCount: number;
  halfDayScore: number;
  earlyMorningDayCount: number;
  keyString: string;
  totalCredits: number;
}

export interface ArrangementSearchDiagnostics {
  precomputedGroupCount: number;
  visitedLeaves: number;
  maxDepth: number;
  maxRetainedCandidates: number;
}

interface PrecomputedGroup {
  group: CourseGroup;
  favoriteCourse: boolean;
  keyId: number;
  expandedIntervals: ExpandedInterval[];
  occupiedDayPeriods: string[];
  earlyMorningDays: number[];
  campusVisits: CampusVisit[];
  blockedSlotHit: boolean;
  credits: number;
  hours: number;
  conflictNeighbors: number[];
}

interface ExpandedInterval {
  week: number;
  day: number;
  start: number;
  end: number;
}

interface IndexedInterval extends ExpandedInterval {
  groupIndex: number;
}

interface TotalsSnapshot {
  totalCredits: number;
  totalHours: number;
}

interface RankedCandidate {
  groupIndices: number[];
  id: string;
  rank: ArrangementRank;
  totalHours: number;
  ordinal: number;
}

export function compareArrangementRanks(
  left: ArrangementRank,
  right: ArrangementRank,
  settings: CustomScheduleSettings,
): number {
  if (left.favoriteArrangement !== right.favoriteArrangement) {
    return left.favoriteArrangement ? -1 : 1;
  }
  if (left.conflictCount !== right.conflictCount) {
    return left.conflictCount - right.conflictCount;
  }
  if (left.favoriteCourseCount !== right.favoriteCourseCount) {
    return right.favoriteCourseCount - left.favoriteCourseCount;
  }
  if (settings.preferAvoidCampusTransfers) {
    const campusDelta = left.campusTransitionCount - right.campusTransitionCount;
    if (campusDelta !== 0) return campusDelta;
  }
  if (settings.preferHalfDay) {
    const halfDayDelta = right.halfDayScore - left.halfDayScore;
    if (halfDayDelta !== 0) return halfDayDelta;
  }
  if (settings.preferFewerEarlyMornings) {
    const earlyDelta = left.earlyMorningDayCount - right.earlyMorningDayCount;
    if (earlyDelta !== 0) return earlyDelta;
  }
  if (left.keyString !== right.keyString) {
    return left.keyString < right.keyString ? -1 : 1;
  }
  const creditDelta = right.totalCredits - left.totalCredits;
  return Number.isNaN(creditDelta) ? 0 : creditDelta;
}

function compareCandidates(
  left: RankedCandidate,
  right: RankedCandidate,
  settings: CustomScheduleSettings,
): number {
  const rankDelta = compareArrangementRanks(left.rank, right.rank, settings);
  return rankDelta !== 0 ? rankDelta : left.ordinal - right.ordinal;
}

/** Capacity-limited max heap whose root is the currently worst retained candidate. */
class BoundedCandidateHeap {
  private readonly values: RankedCandidate[] = [];
  private readonly capacity: number;
  private readonly settings: CustomScheduleSettings;

  constructor(capacity: number, settings: CustomScheduleSettings) {
    this.capacity = capacity;
    this.settings = settings;
  }

  get size(): number {
    return this.values.length;
  }

  add(candidate: RankedCandidate): void {
    if (this.values.length < this.capacity) {
      this.values.push(candidate);
      this.siftUp(this.values.length - 1);
      return;
    }
    if (compareCandidates(candidate, this.values[0], this.settings) >= 0) return;
    this.values[0] = candidate;
    this.siftDown(0);
  }

  sortedBestFirst(): RankedCandidate[] {
    return [...this.values].sort((left, right) =>
      compareCandidates(left, right, this.settings));
  }

  private siftUp(startIndex: number): void {
    let index = startIndex;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareCandidates(this.values[index], this.values[parent], this.settings) <= 0) {
        break;
      }
      [this.values[index], this.values[parent]] = [this.values[parent], this.values[index]];
      index = parent;
    }
  }

  private siftDown(startIndex: number): void {
    let index = startIndex;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let worst = index;
      if (
        left < this.values.length
        && compareCandidates(this.values[left], this.values[worst], this.settings) > 0
      ) {
        worst = left;
      }
      if (
        right < this.values.length
        && compareCandidates(this.values[right], this.values[worst], this.settings) > 0
      ) {
        worst = right;
      }
      if (worst === index) return;
      [this.values[index], this.values[worst]] = [this.values[worst], this.values[index]];
      index = worst;
    }
  }
}

function precomputeGroups(
  groups: CourseGroup[],
  blockedSlots: Set<string>,
  favoriteTimeGroupKeys: Set<string>,
  favoriteSectionIds: Set<string>,
): PrecomputedGroup[] {
  const keyIds = new Map<string, number>();
  const blockedByDay = blockedMinuteIntervalsByDay(blockedSlots);
  const records = groups.map((group): PrecomputedGroup => {
    let keyId = keyIds.get(group.key);
    if (keyId === undefined) {
      keyId = keyIds.size;
      keyIds.set(group.key, keyId);
    }

    const expandedIntervals = new Map<string, ExpandedInterval>();
    const occupiedDayPeriods = new Set<string>();
    const earlyMorningDays = new Set<number>();
    let blockedSlotHit = false;
    for (const slot of group.schedule) {
      const minuteIntervals = scheduleSlotMinuteIntervals(slot);
      for (const week of expandWeeks(slot.weeks)) {
        for (const interval of minuteIntervals) {
          const expanded = { week, day: slot.day, ...interval };
          expandedIntervals.set(
            `${week}-${slot.day}-${interval.start}-${interval.end}`,
            expanded,
          );
        }
      }
      if (slot.day >= 1 && slot.day <= 7) {
        for (const period of slot.periods) {
          occupiedDayPeriods.add(blockedSlotKey(slot.day, period));
        }
      }
      if (slot.periods.some((period) => period === 1 || period === 2)) {
        earlyMorningDays.add(slot.day);
      }
      if (scheduleSlotOverlapsBlocked(slot, blockedByDay)) {
        blockedSlotHit = true;
      }
    }
    const representative = group.sections[0];
    return {
      group,
      favoriteCourse: favoriteTimeGroupKeys.has(group.key)
        || group.sectionIds.some((id) => favoriteSectionIds.has(id)),
      keyId,
      expandedIntervals: [...expandedIntervals.values()],
      occupiedDayPeriods: [...occupiedDayPeriods],
      earlyMorningDays: [...earlyMorningDays],
      campusVisits: campusVisitsForGroup(group),
      blockedSlotHit,
      credits: representative ? representative.credits : 0,
      hours: representative ? representative.hours : 0,
      conflictNeighbors: [],
    };
  });

  const intervalsByWeekDay = new Map<string, IndexedInterval[]>();
  for (let index = 0; index < records.length; index += 1) {
    for (const interval of records[index].expandedIntervals) {
      const key = `${interval.week}-${interval.day}`;
      const indexed = { groupIndex: index, ...interval };
      const occupants = intervalsByWeekDay.get(key);
      if (occupants) occupants.push(indexed);
      else intervalsByWeekDay.set(key, [indexed]);
    }
  }

  const neighbors = records.map(() => new Set<number>());
  for (const occupants of intervalsByWeekDay.values()) {
    occupants.sort((left, right) => left.start - right.start || left.end - right.end);
    for (let leftIndex = 0; leftIndex < occupants.length; leftIndex += 1) {
      const left = occupants[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < occupants.length; rightIndex += 1) {
        const right = occupants[rightIndex];
        if (right.start >= left.end) break;
        if (left.groupIndex === right.groupIndex || !minuteIntervalsOverlap(left, right)) continue;
        if (records[left.groupIndex].keyId === records[right.groupIndex].keyId) continue;
        neighbors[left.groupIndex].add(right.groupIndex);
        neighbors[right.groupIndex].add(left.groupIndex);
      }
    }
  }
  for (let index = 0; index < records.length; index += 1) {
    records[index].conflictNeighbors = [...neighbors[index]];
  }
  return records;
}

class IncrementalSearchState {
  private readonly records: PrecomputedGroup[];
  private readonly selected: boolean[];
  private readonly blockedConflictRefs: number[];
  private readonly overlapConflictRefs: number[];
  private readonly occupiedDayPeriodRefs = new Map<string, number>();
  private readonly earlyMorningDayRefs = new Map<number, number>();
  private readonly campusVisitsByBucket = new Map<string, CampusVisit[]>();
  private readonly residentCampus: ResidentCampus;
  private readonly trackCampusTransfers: boolean;

  conflictCount = 0;
  favoriteCourseCount = 0;
  campusTransitionCount = 0;
  earlyMorningDayCount = 0;
  totalCredits = 0;
  totalHours = 0;

  constructor(
    records: PrecomputedGroup[],
    blockedSlots: Set<string>,
    residentCampus: ResidentCampus,
    trackCampusTransfers: boolean,
  ) {
    this.records = records;
    this.residentCampus = residentCampus;
    this.trackCampusTransfers = trackCampusTransfers;
    this.selected = Array.from({ length: records.length }, () => false);
    const keyCount = records.reduce((highest, record) => Math.max(highest, record.keyId + 1), 0);
    this.blockedConflictRefs = Array.from({ length: keyCount }, () => 0);
    this.overlapConflictRefs = Array.from({ length: keyCount }, () => 0);
    for (const key of blockedSlots) {
      const [day, period] = key.split('-').map(Number);
      if (day >= 1 && day <= 7) this.incrementMap(this.occupiedDayPeriodRefs, `${day}-${period}`);
    }
  }

  add(groupIndex: number): TotalsSnapshot {
    const record = this.records[groupIndex];
    const snapshot = {
      totalCredits: this.totalCredits,
      totalHours: this.totalHours,
    };
    this.selected[groupIndex] = true;
    if (record.favoriteCourse) this.favoriteCourseCount += 1;
    if (record.blockedSlotHit) this.adjustConflictRef(this.blockedConflictRefs, record.keyId, 1);
    for (const neighborIndex of record.conflictNeighbors) {
      if (!this.selected[neighborIndex]) continue;
      this.adjustConflictRef(this.overlapConflictRefs, record.keyId, 1);
      this.adjustConflictRef(
        this.overlapConflictRefs,
        this.records[neighborIndex].keyId,
        1,
      );
    }
    for (const key of record.occupiedDayPeriods) this.incrementMap(this.occupiedDayPeriodRefs, key);
    for (const day of record.earlyMorningDays) {
      const previous = this.earlyMorningDayRefs.get(day) ?? 0;
      this.earlyMorningDayRefs.set(day, previous + 1);
      if (previous === 0) this.earlyMorningDayCount += 1;
    }
    if (this.trackCampusTransfers) {
      for (const visit of record.campusVisits) this.addCampusVisit(visit);
    }
    this.totalCredits += record.credits;
    this.totalHours += record.hours;
    return snapshot;
  }

  remove(groupIndex: number, snapshot: TotalsSnapshot): void {
    const record = this.records[groupIndex];
    if (record.blockedSlotHit) this.adjustConflictRef(this.blockedConflictRefs, record.keyId, -1);
    for (const neighborIndex of record.conflictNeighbors) {
      if (!this.selected[neighborIndex]) continue;
      this.adjustConflictRef(this.overlapConflictRefs, record.keyId, -1);
      this.adjustConflictRef(
        this.overlapConflictRefs,
        this.records[neighborIndex].keyId,
        -1,
      );
    }
    this.selected[groupIndex] = false;
    if (record.favoriteCourse) this.favoriteCourseCount -= 1;
    for (const key of record.occupiedDayPeriods) this.decrementMap(this.occupiedDayPeriodRefs, key);
    for (const day of record.earlyMorningDays) {
      const previous = this.earlyMorningDayRefs.get(day) ?? 0;
      if (previous <= 1) {
        this.earlyMorningDayRefs.delete(day);
        this.earlyMorningDayCount -= 1;
      } else {
        this.earlyMorningDayRefs.set(day, previous - 1);
      }
    }
    if (this.trackCampusTransfers) {
      for (const visit of record.campusVisits) this.removeCampusVisit(visit);
    }
    this.totalCredits = snapshot.totalCredits;
    this.totalHours = snapshot.totalHours;
  }

  halfDayScore(): number {
    let best = 0;
    for (let day = 1; day <= 5; day += 1) {
      let afternoonAndEveningEmpty = true;
      for (let period = 6; period <= 13; period += 1) {
        if (this.occupiedDayPeriodRefs.has(`${day}-${period}`)) {
          afternoonAndEveningEmpty = false;
          break;
        }
      }
      if (afternoonAndEveningEmpty) return 2;

      let afternoonEmpty = true;
      for (let period = 6; period <= 10; period += 1) {
        if (this.occupiedDayPeriodRefs.has(`${day}-${period}`)) {
          afternoonEmpty = false;
          break;
        }
      }
      if (afternoonEmpty) best = 1;
    }
    return best;
  }

  private isKeyConflicted(keyId: number): boolean {
    return this.blockedConflictRefs[keyId] > 0 || this.overlapConflictRefs[keyId] > 0;
  }

  private adjustConflictRef(refs: number[], keyId: number, delta: 1 | -1): void {
    const wasConflicted = this.isKeyConflicted(keyId);
    refs[keyId] += delta;
    const isConflicted = this.isKeyConflicted(keyId);
    if (wasConflicted !== isConflicted) this.conflictCount += isConflicted ? 1 : -1;
  }

  private incrementMap<Key>(map: Map<Key, number>, key: Key): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private decrementMap<Key>(map: Map<Key, number>, key: Key): void {
    const previous = map.get(key) ?? 0;
    if (previous <= 1) map.delete(key);
    else map.set(key, previous - 1);
  }

  private addCampusVisit(visit: CampusVisit): void {
    const bucket = this.campusVisitsByBucket.get(visit.bucketKey) ?? [];
    const previous = scoreCampusVisits(bucket, this.residentCampus);
    bucket.push(visit);
    this.campusVisitsByBucket.set(visit.bucketKey, bucket);
    this.campusTransitionCount += scoreCampusVisits(bucket, this.residentCampus) - previous;
  }

  private removeCampusVisit(visit: CampusVisit): void {
    const bucket = this.campusVisitsByBucket.get(visit.bucketKey);
    if (!bucket) return;
    const previous = scoreCampusVisits(bucket, this.residentCampus);
    const index = bucket.indexOf(visit);
    if (index === -1) return;
    bucket.splice(index, 1);
    if (bucket.length === 0) this.campusVisitsByBucket.delete(visit.bucketKey);
    this.campusTransitionCount += scoreCampusVisits(bucket, this.residentCampus) - previous;
  }
}

function resetDiagnostics(diagnostics: ArrangementSearchDiagnostics | undefined): void {
  if (!diagnostics) return;
  diagnostics.precomputedGroupCount = 0;
  diagnostics.visitedLeaves = 0;
  diagnostics.maxDepth = 0;
  diagnostics.maxRetainedCandidates = 0;
}

export function enumerateArrangementResultsExact(
  groups: CourseGroup[],
  settings: CustomScheduleSettings = DEFAULT_CUSTOM_SETTINGS,
  options: ArrangementEnumerationOptions = {},
): ArrangementEnumerationResult {
  const { diagnostics, favorites, mode = 'recommended' } = options;
  resetDiagnostics(diagnostics);
  if (groups.length === 0) {
    return {
      arrangements: [],
      conflictFreePreview: [],
      totalConflictFreeCount: 0,
    };
  }

  const blockedSlots = new Set(settings.blockedSlots);
  const favoriteArrangementIds = new Set(favorites?.arrangementIds ?? []);
  const favoriteTimeGroupKeys = new Set(favorites?.timeGroupKeys ?? []);
  const favoriteSectionIds = new Set(favorites?.sectionIds ?? []);
  const records = precomputeGroups(
    groups,
    blockedSlots,
    favoriteTimeGroupKeys,
    favoriteSectionIds,
  );
  if (diagnostics) diagnostics.precomputedGroupCount = records.length;

  const byCode = new Map<string, number[]>();
  const codeOrder: string[] = [];
  for (let index = 0; index < groups.length; index += 1) {
    const code = groups[index].courseCode;
    const bucket = byCode.get(code);
    if (bucket) bucket.push(index);
    else {
      byCode.set(code, [index]);
      codeOrder.push(code);
    }
  }

  const lockedIndices: number[] = [];
  const ambiguousBuckets: number[][] = [];
  for (const code of codeOrder) {
    const bucket = byCode.get(code)!;
    if (bucket.length === 1) lockedIndices.push(bucket[0]);
      else ambiguousBuckets.push(bucket);
  }

  const state = new IncrementalSearchState(
    records,
    blockedSlots,
    settings.residentCampus,
    settings.preferAvoidCampusTransfers,
  );
  for (const groupIndex of lockedIndices) state.add(groupIndex);

  const pickedIndices: number[] = [];
  const arrangementDisplayCount = settings.arrangementDisplayCount
    ?? DEFAULT_CUSTOM_SETTINGS.arrangementDisplayCount;
  const recommended = new BoundedCandidateHeap(arrangementDisplayCount, settings);
  const favoriteCandidates: RankedCandidate[] = [];
  const conflictFreePreview = new BoundedCandidateHeap(ARRANGEMENT_RESULT_LIMIT, settings);
  const allConflictFree: RankedCandidate[] = [];
  let totalConflictFreeCount = 0;
  let ordinal = 0;

  const visit = (depth: number): void => {
    if (diagnostics) diagnostics.maxDepth = Math.max(diagnostics.maxDepth, depth);
    if (depth === ambiguousBuckets.length) {
      if (diagnostics) diagnostics.visitedLeaves += 1;
      const groupIndices = [...lockedIndices, ...pickedIndices];
      const sortedKeys = groupIndices.map((index) => records[index].group.key).sort();
      const id = sortedKeys.join('||');
      const candidate: RankedCandidate = {
        groupIndices,
        id,
        rank: {
          favoriteArrangement: favoriteArrangementIds.has(id),
          conflictCount: state.conflictCount,
          favoriteCourseCount: state.favoriteCourseCount,
          campusTransitionCount: settings.preferAvoidCampusTransfers
            ? state.campusTransitionCount
            : 0,
          halfDayScore: settings.preferHalfDay ? state.halfDayScore() : 0,
          earlyMorningDayCount: settings.preferFewerEarlyMornings
            ? state.earlyMorningDayCount
            : 0,
          keyString: sortedKeys.join('|'),
          totalCredits: state.totalCredits,
        },
        totalHours: state.totalHours,
        ordinal,
      };
      ordinal += 1;
      if (candidate.rank.favoriteArrangement) favoriteCandidates.push(candidate);
      else recommended.add(candidate);
      if (candidate.rank.conflictCount === 0) {
        totalConflictFreeCount += 1;
        conflictFreePreview.add(candidate);
        if (mode === 'all-conflict-free') allConflictFree.push(candidate);
      }
      if (diagnostics) {
        diagnostics.maxRetainedCandidates = Math.max(
          diagnostics.maxRetainedCandidates,
          recommended.size + favoriteCandidates.length,
          conflictFreePreview.size,
        );
      }
      return;
    }

    for (const groupIndex of ambiguousBuckets[depth]) {
      const snapshot = state.add(groupIndex);
      pickedIndices.push(groupIndex);
      visit(depth + 1);
      pickedIndices.pop();
      state.remove(groupIndex, snapshot);
    }
  };

  visit(0);

  const toArrangement = (candidate: RankedCandidate): Arrangement => ({
    id: candidate.id,
    groups: candidate.groupIndices.map((index) => records[index].group),
    conflictCount: candidate.rank.conflictCount,
    courseCount: candidate.groupIndices.length,
    totalCredits: candidate.rank.totalCredits,
    totalHours: candidate.totalHours,
  });
  const preview = conflictFreePreview.sortedBestFirst();
  const sortedFavorites = favoriteCandidates.sort((left, right) =>
    compareCandidates(left, right, settings));
  const remainingRecommendedCount = Math.max(
    0,
    arrangementDisplayCount - sortedFavorites.length,
  );
  const recommendedCandidates = [
    ...sortedFavorites,
    ...recommended.sortedBestFirst().slice(0, remainingRecommendedCount),
  ];
  return {
    arrangements: (mode === 'all-conflict-free'
      ? allConflictFree.sort((left, right) => compareCandidates(left, right, settings))
      : recommendedCandidates).map(toArrangement),
    conflictFreePreview: preview.map(toArrangement),
    totalConflictFreeCount,
  };
}

export function enumerateArrangementsExact(
  groups: CourseGroup[],
  settings: CustomScheduleSettings = DEFAULT_CUSTOM_SETTINGS,
  diagnostics?: ArrangementSearchDiagnostics,
  favorites?: ArrangementFavoritePreferences,
): Arrangement[] {
  return enumerateArrangementResultsExact(groups, settings, { diagnostics, favorites })
    .arrangements;
}
