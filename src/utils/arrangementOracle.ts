/**
 * Test-only brute-force oracle copied from the legacy production enumerator.
 * Keep this implementation independent from the optimized engine so differential
 * tests can detect ranking, metric, and output-shape regressions.
 */
import type { Arrangement, CourseGroup } from '@/types';
import { expandWeeks } from './weeks';
import {
  DEFAULT_CUSTOM_SETTINGS,
  type CustomScheduleSettings,
} from './customization';
import {
  blockedMinuteIntervalsByDay,
  minuteIntervalsOverlap,
  scheduleSlotMinuteIntervals,
  scheduleSlotOverlapsBlocked,
} from './scheduleTime';

function weeksOverlap(left: number[], right: number[]): boolean {
  const leftWeeks = new Set(expandWeeks(left));
  return expandWeeks(right).some((week) => leftWeeks.has(week));
}

function groupsOverlap(left: CourseGroup, right: CourseGroup): boolean {
  for (const leftSlot of left.schedule) {
    for (const rightSlot of right.schedule) {
      if (leftSlot.day !== rightSlot.day || !weeksOverlap(leftSlot.weeks, rightSlot.weeks)) {
        continue;
      }
      const leftIntervals = scheduleSlotMinuteIntervals(leftSlot);
      const rightIntervals = scheduleSlotMinuteIntervals(rightSlot);
      if (leftIntervals.some((leftInterval) =>
        rightIntervals.some((rightInterval) =>
          minuteIntervalsOverlap(leftInterval, rightInterval)))) {
        return true;
      }
    }
  }
  return false;
}

function countConflicts(groups: CourseGroup[], blockedSlots: Set<string>): number {
  const seen = new Set<string>();
  for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
      if (!groupsOverlap(groups[leftIndex], groups[rightIndex])) continue;
      seen.add(groups[leftIndex].key);
      seen.add(groups[rightIndex].key);
    }
  }
  if (blockedSlots.size > 0) {
    const blockedByDay = blockedMinuteIntervalsByDay(blockedSlots);
    for (const group of groups) {
      if (group.schedule.some((slot) => scheduleSlotOverlapsBlocked(slot, blockedByDay))) {
        seen.add(group.key);
      }
    }
  }
  return seen.size;
}

function occupiedPeriodsByDay(
  groups: CourseGroup[],
  blockedSlots: Set<string>,
): Map<number, Set<number>> {
  const occupied = new Map<number, Set<number>>();
  for (let day = 1; day <= 7; day += 1) occupied.set(day, new Set());
  for (const group of groups) {
    for (const slot of group.schedule) {
      const periods = occupied.get(slot.day);
      if (!periods) continue;
      for (const period of slot.periods) periods.add(period);
    }
  }
  for (const key of blockedSlots) {
    const [day, period] = key.split('-').map(Number);
    occupied.get(day)?.add(period);
  }
  return occupied;
}

function halfDayScore(groups: CourseGroup[], blockedSlots: Set<string>): number {
  const occupied = occupiedPeriodsByDay(groups, blockedSlots);
  let best = 0;
  for (let day = 1; day <= 5; day += 1) {
    const periods = occupied.get(day) ?? new Set<number>();
    const afternoonAndEveningEmpty = Array.from({ length: 8 }, (_, index) => index + 6)
      .every((period) => !periods.has(period));
    if (afternoonAndEveningEmpty) best = Math.max(best, 2);
    else {
      const afternoonEmpty = Array.from({ length: 5 }, (_, index) => index + 6)
        .every((period) => !periods.has(period));
      if (afternoonEmpty) best = Math.max(best, 1);
    }
  }
  return best;
}

function earlyMorningDayCount(groups: CourseGroup[]): number {
  const days = new Set<number>();
  for (const group of groups) {
    for (const slot of group.schedule) {
      if (slot.periods.some((period) => period === 1 || period === 2)) days.add(slot.day);
    }
  }
  return days.size;
}

function sumCredits(groups: CourseGroup[]): number {
  let c = 0;
  for (const g of groups) {
    const rep = g.sections[0];
    if (rep) c += rep.credits;
  }
  return c;
}

function sumHours(groups: CourseGroup[]): number {
  let h = 0;
  for (const g of groups) {
    const rep = g.sections[0];
    if (rep) h += rep.hours;
  }
  return h;
}

function arrangementId(groups: CourseGroup[]): string {
  return groups.map((g) => g.key).sort().join('||');
}

function cartesian<T>(lists: T[][]): T[][] {
  if (lists.length === 0) return [[]];
  const [head, ...tail] = lists;
  const out: T[][] = [];
  for (const item of head) {
    for (const rest of cartesian(tail)) {
      out.push([item, ...rest]);
    }
  }
  return out;
}

export function enumerateArrangementsOracle(
  groups: CourseGroup[],
  settings: CustomScheduleSettings = DEFAULT_CUSTOM_SETTINGS,
): Arrangement[] {
  if (groups.length === 0) return [];
  const blockedSlots = new Set(settings.blockedSlots);

  const byCode = new Map<string, CourseGroup[]>();
  const order: string[] = [];
  for (const g of groups) {
    const arr = byCode.get(g.courseCode);
    if (!arr) {
      byCode.set(g.courseCode, [g]);
      order.push(g.courseCode);
    } else {
      arr.push(g);
    }
  }

  const locked: CourseGroup[] = [];
  const ambiguousChoices: CourseGroup[][] = [];
  for (const code of order) {
    const arr = byCode.get(code)!;
    if (arr.length === 1) locked.push(arr[0]);
    else ambiguousChoices.push(arr);
  }

  const combos = cartesian(ambiguousChoices);

  const arrs: Arrangement[] = combos.map((picked) => {
    const allGroups = [...locked, ...picked];
    return {
      id: arrangementId(allGroups),
      groups: allGroups,
      conflictCount: countConflicts(allGroups, blockedSlots),
      courseCount: allGroups.length,
      totalCredits: sumCredits(allGroups),
      totalHours: sumHours(allGroups),
    };
  });

  arrs.sort((a, b) => {
    if (a.conflictCount !== b.conflictCount) return a.conflictCount - b.conflictCount;
    if (settings.preferHalfDay) {
      const scoreDelta = halfDayScore(b.groups, blockedSlots) - halfDayScore(a.groups, blockedSlots);
      if (scoreDelta !== 0) return scoreDelta;
    }
    if (settings.preferFewerEarlyMornings) {
      const earlyDelta = earlyMorningDayCount(a.groups) - earlyMorningDayCount(b.groups);
      if (earlyDelta !== 0) return earlyDelta;
    }
    const aKeys = a.groups.map((g) => g.key).sort().join('|');
    const bKeys = b.groups.map((g) => g.key).sort().join('|');
    if (aKeys !== bKeys) return aKeys < bKeys ? -1 : 1;
    return b.totalCredits - a.totalCredits;
  });

  return arrs.slice(0, 8);
}
