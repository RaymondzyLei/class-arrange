import { describe, expect, it } from 'vitest';
import type {
  ArrangementFavoritePreferences,
  CourseGroup,
  CourseSection,
  ScheduleSlot,
} from '@/types';
import type { CustomScheduleSettings } from './customization';
import { enumerateArrangements } from './arrangement';
import {
  compareArrangementRanks,
  enumerateArrangementResultsExact,
  enumerateArrangementsExact,
  type ArrangementRank,
  type ArrangementSearchDiagnostics,
} from './arrangementEngine';
import { enumerateArrangementsOracle } from './arrangementOracle';

const NO_PREFERENCES: CustomScheduleSettings = {
  calculationMode: 'auto',
  arrangementDisplayCount: 8,
  mergeAllTimeGroups: false,
  preferHalfDay: false,
  preferFewerEarlyMornings: false,
  preferAvoidCampusTransfers: false,
  residentCampus: '本部',
  blockedSlots: [],
};

describe('exact conflict-free result policy', () => {
  it('keeps a 100-result preview, reports the exact total, and can load every result', () => {
    const groups = Array.from({ length: 105 }, (_, index) => makeGroup(
      'C',
      `C::candidate-${index.toString().padStart(3, '0')}`,
    ));
    const result = enumerateArrangementResultsExact(groups, {
      ...NO_PREFERENCES,
      arrangementDisplayCount: 2,
    });

    expect(result.arrangements).toHaveLength(2);
    expect(result.conflictFreePreview).toHaveLength(100);
    expect(result.totalConflictFreeCount).toBe(105);
    expect(enumerateArrangementsExact(groups, {
      ...NO_PREFERENCES,
      arrangementDisplayCount: 2,
    })).toEqual(result.arrangements);
    expect(enumerateArrangementResultsExact(groups, NO_PREFERENCES, {
      mode: 'all-conflict-free',
    }).arrangements).toHaveLength(105);
  });
});

function makeSection(
  id: string,
  credits: number,
  hours: number,
  schedule: ScheduleSlot[],
): CourseSection {
  return {
    id,
    courseName: id,
    department: { code: 'TEST', name: 'Test' },
    teacher: 'Teacher',
    credits,
    hours,
    level: '',
    sectionType: '',
    category: '',
    courseType: '',
    language: '',
    examType: '',
    grading: '',
    undergradShared: false,
    enrolled: 0,
    capacity: 0,
    classes: [],
    rawSchedule: '',
    schedule,
  };
}

function makeGroup(
  courseCode: string,
  key: string,
  schedule: ScheduleSlot[] = [],
  credits = 0,
  hours = 0,
): CourseGroup {
  return {
    courseCode,
    courseName: `Course ${courseCode}`,
    schedule,
    fingerprint: key,
    sectionIds: [`${courseCode}.${key}`],
    teachers: ['Teacher'],
    sections: [makeSection(`${courseCode}.${key}`, credits, hours, schedule)],
    key,
  };
}

function makeRank(overrides: Partial<ArrangementRank> = {}): ArrangementRank {
  return {
    favoriteArrangement: false,
    conflictCount: 0,
    favoriteCourseCount: 0,
    campusTransitionCount: 0,
    halfDayScore: 0,
    earlyMorningDayCount: 0,
    keyString: 'same',
    totalCredits: 0,
    ...overrides,
  };
}

describe('compareArrangementRanks', () => {
  it('orders exact favorites, conflicts, and distinct favorite courses first', () => {
    expect(compareArrangementRanks(
      makeRank({ favoriteArrangement: true, conflictCount: 3 }),
      makeRank({ favoriteArrangement: false, conflictCount: 0 }),
      NO_PREFERENCES,
    )).toBeLessThan(0);

    expect(compareArrangementRanks(
      makeRank({ conflictCount: 0, favoriteCourseCount: 0 }),
      makeRank({ conflictCount: 1, favoriteCourseCount: 3 }),
      NO_PREFERENCES,
    )).toBeLessThan(0);

    expect(compareArrangementRanks(
      makeRank({ conflictCount: 0, favoriteCourseCount: 2 }),
      makeRank({ conflictCount: 0, favoriteCourseCount: 1 }),
      NO_PREFERENCES,
    )).toBeLessThan(0);
  });

  it('applies the exact conflict, half-day, early-morning, key, and credit ordering', () => {
    const allPreferences: CustomScheduleSettings = {
      calculationMode: 'auto',
      arrangementDisplayCount: 8,
      mergeAllTimeGroups: false,
      preferHalfDay: true,
      preferFewerEarlyMornings: true,
      preferAvoidCampusTransfers: true,
      residentCampus: '本部',
      blockedSlots: [],
    };

    expect(compareArrangementRanks(
      makeRank({ conflictCount: 0, keyString: 'z' }),
      makeRank({ conflictCount: 1, keyString: 'a' }),
      allPreferences,
    )).toBeLessThan(0);
    expect(compareArrangementRanks(
      makeRank({ campusTransitionCount: 0, halfDayScore: 0, keyString: 'z' }),
      makeRank({ campusTransitionCount: 1, halfDayScore: 2, keyString: 'a' }),
      allPreferences,
    )).toBeLessThan(0);
    expect(compareArrangementRanks(
      makeRank({ halfDayScore: 2, keyString: 'z' }),
      makeRank({ halfDayScore: 1, keyString: 'a' }),
      allPreferences,
    )).toBeLessThan(0);
    expect(compareArrangementRanks(
      makeRank({ earlyMorningDayCount: 0, keyString: 'z' }),
      makeRank({ earlyMorningDayCount: 1, keyString: 'a' }),
      allPreferences,
    )).toBeLessThan(0);
    expect(compareArrangementRanks(
      makeRank({ keyString: 'a' }),
      makeRank({ keyString: 'b' }),
      allPreferences,
    )).toBeLessThan(0);
    expect(compareArrangementRanks(
      makeRank({ totalCredits: 4 }),
      makeRank({ totalCredits: 3 }),
      allPreferences,
    )).toBeLessThan(0);
  });

  it('skips disabled preference keys', () => {
    expect(compareArrangementRanks(
      makeRank({ campusTransitionCount: 9, halfDayScore: 0, earlyMorningDayCount: 7, keyString: 'a' }),
      makeRank({ campusTransitionCount: 0, halfDayScore: 2, earlyMorningDayCount: 0, keyString: 'b' }),
      NO_PREFERENCES,
    )).toBeLessThan(0);
  });
});

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function randomInteger(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function randomGroups(seed: number): CourseGroup[] {
  const random = seededRandom(seed);
  const groups: CourseGroup[] = [];
  const courseCount = randomInteger(random, 1, 4);
  for (let courseIndex = 0; courseIndex < courseCount; courseIndex += 1) {
    const courseCode = `C${courseIndex}`;
    const candidateCount = randomInteger(random, 1, 3);
    for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
      const schedule: ScheduleSlot[] = [];
      const slotCount = randomInteger(random, 0, 2);
      for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
        const firstWeek = randomInteger(random, 1, 3);
        const firstPeriod = randomInteger(random, 1, 12);
        schedule.push({
          weeks: random() < 0.5
            ? [firstWeek, firstWeek + randomInteger(random, 0, 2)]
            : [1, 3, 5],
          day: randomInteger(random, 1, 7),
          periods: random() < 0.5 && firstPeriod < 13
            ? [firstPeriod, firstPeriod + 1]
            : [firstPeriod],
          room: '',
          campus: random() < 0.5 ? '本部' : '高新区',
        });
      }
      const key = `${courseCode}::candidate-${candidateIndex}-seed-${seed}`;
      groups.push(makeGroup(
        courseCode,
        key,
        schedule,
        randomInteger(random, 1, 10) / 10,
        randomInteger(random, 1, 6) * 16,
      ));
    }
  }

  for (let index = groups.length - 1; index > 0; index -= 1) {
    const other = randomInteger(random, 0, index);
    [groups[index], groups[other]] = [groups[other], groups[index]];
  }
  return groups;
}

function blockedSlotsForSeed(seed: number): string[] {
  const candidates = ['1-1', '2-6', '3-8', '5-13'];
  return candidates.filter((_, index) => (seed & (1 << index)) !== 0);
}

function favoriteSnapshotForGroups(groups: CourseGroup[]): ArrangementFavoritePreferences {
  const firstByCode = new Map<string, CourseGroup>();
  for (const group of groups) {
    if (!firstByCode.has(group.courseCode)) firstByCode.set(group.courseCode, group);
  }
  return {
    arrangementIds: [[...firstByCode.values()].map((group) => group.key).sort().join('||')],
    timeGroupKeys: groups.length > 0 ? [groups[groups.length - 1].key] : [],
    sectionIds: groups.length > 0 ? [groups[0].sectionIds[0]] : [],
  };
}

describe('exact Top-8 differential contract', () => {
  it('matches every oracle field and result position for seeded small inputs', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const groups = randomGroups(seed);
      for (const preferHalfDay of [false, true]) {
        for (const preferFewerEarlyMornings of [false, true]) {
          for (const preferAvoidCampusTransfers of [false, true]) {
          const settings: CustomScheduleSettings = {
            calculationMode: 'auto',
            arrangementDisplayCount: 8,
            mergeAllTimeGroups: false,
            preferHalfDay,
            preferFewerEarlyMornings,
            preferAvoidCampusTransfers,
            residentCampus: seed % 2 === 0 ? '本部' : '高新区',
            blockedSlots: blockedSlotsForSeed(seed),
          };
          const favorites = favoriteSnapshotForGroups(groups);
          const expected = enumerateArrangementsOracle(groups, settings, favorites);
          const actual = enumerateArrangements(groups, settings, favorites);
          expect(
            actual,
            `seed=${seed}, halfDay=${preferHalfDay}, early=${preferFewerEarlyMornings}, campus=${preferAvoidCampusTransfers}`,
          ).toEqual(expected);
          }
        }
      }
    }
  });

  it('ranks a lexicographically later favorite time group first', () => {
    const groups = [
      makeGroup('A', 'a-default'),
      makeGroup('A', 'z-favorite'),
    ];

    expect(enumerateArrangements(groups, NO_PREFERENCES, {
      arrangementIds: [],
      timeGroupKeys: ['z-favorite'],
      sectionIds: [],
    }).map((result) => result.id)).toEqual(['z-favorite', 'a-default']);
  });

  it('counts a group once when its key and multiple section IDs are favorites', () => {
    const duplicateMatch = makeGroup('A', 'z-duplicate-match');
    duplicateMatch.sectionIds = ['A.section-1', 'A.section-2'];
    duplicateMatch.sections = [
      makeSection('A.section-1', 0, 0, []),
      makeSection('A.section-2', 0, 0, []),
    ];
    const singleMatch = makeGroup('A', 'a-single-match');
    const lockedFavorite = makeGroup('B', 'b-locked-favorite');

    const results = enumerateArrangements(
      [duplicateMatch, singleMatch, lockedFavorite],
      NO_PREFERENCES,
      {
        arrangementIds: [],
        timeGroupKeys: ['z-duplicate-match', 'b-locked-favorite'],
        sectionIds: [
          'A.section-1',
          'A.section-2',
          singleMatch.sectionIds[0],
        ],
      },
    );

    expect(results.map((result) => result.id)).toEqual([
      'a-single-match||b-locked-favorite',
      'b-locked-favorite||z-duplicate-match',
    ]);
  });

  it('applies favorite ranking before bounded Top-N truncation', () => {
    const groups = [
      makeGroup('A', 'a-first'),
      makeGroup('A', 'b-second'),
      makeGroup('A', 'z-favorite'),
    ];

    const results = enumerateArrangements(groups, {
      ...NO_PREFERENCES,
      arrangementDisplayCount: 2,
    }, {
      arrangementIds: [],
      timeGroupKeys: [],
      sectionIds: [groups[2].sectionIds[0]],
    });

    expect(results.map((result) => result.id)).toEqual(['z-favorite', 'a-first']);
  });

  it('retains every valid favorite arrangement beyond the display limit', () => {
    const groups = [
      makeGroup('A', 'a-default'),
      makeGroup('A', 'b-favorite'),
      makeGroup('A', 'c-favorite'),
      makeGroup('A', 'd-favorite'),
    ];
    const settings: CustomScheduleSettings = {
      ...NO_PREFERENCES,
      arrangementDisplayCount: 2,
    };

    expect(enumerateArrangements(groups, settings, {
      arrangementIds: ['b-favorite', 'c-favorite', 'd-favorite'],
      timeGroupKeys: [],
      sectionIds: [],
    }).map((result) => result.id)).toEqual([
      'b-favorite',
      'c-favorite',
      'd-favorite',
    ]);

    expect(enumerateArrangements(groups, settings, {
      arrangementIds: ['missing-favorite'],
      timeGroupKeys: [],
      sectionIds: [],
    }).map((result) => result.id)).toEqual(['a-default', 'b-favorite']);
  });

  it('counts blocked-slot hits without conflating them with timetable overlaps', () => {
    const groups = [
      makeGroup('A', 'a-blocked', [{ weeks: [1, 2], day: 1, periods: [1], room: '', campus: '本部' }]),
      makeGroup('A', 'z-free', [{ weeks: [1, 2], day: 2, periods: [3], room: '', campus: '本部' }]),
      makeGroup('B', 'b-locked', [{ weeks: [1, 2], day: 4, periods: [4], room: '', campus: '本部' }]),
    ];
    const settings: CustomScheduleSettings = {
      ...NO_PREFERENCES,
      blockedSlots: ['1-1'],
    };

    const results = enumerateArrangements(groups, settings);

    expect(results.map((result) => [result.id, result.conflictCount])).toEqual([
      ['b-locked||z-free', 0],
      ['a-blocked||b-locked', 1],
    ]);
  });

  it('matches the oracle for exact clock overlaps and blocked-slot endpoints', () => {
    const groups = [
      makeGroup('A', 'a-touching', [{
        weeks: [1, 2],
        day: 1,
        periods: [11],
        room: '',
        campus: '本部',
        startTime: '19:00',
        endTime: '19:30',
      } as ScheduleSlot]),
      makeGroup('A', 'z-overlap', [{
        weeks: [1, 2],
        day: 1,
        periods: [10],
        room: '',
        campus: '本部',
        startTime: '19:15',
        endTime: '19:45',
      } as ScheduleSlot]),
      makeGroup('B', 'b-standard', [{
        weeks: [1, 2],
        day: 1,
        periods: [11],
        room: '',
        campus: '本部',
      }]),
    ];
    const settings: CustomScheduleSettings = {
      ...NO_PREFERENCES,
      blockedSlots: ['1-11'],
    };

    const expected = enumerateArrangementsOracle(groups, settings);
    const actual = enumerateArrangementsExact(groups, settings);

    expect(actual).toEqual(expected);
    expect(actual.map((result) => [result.id, result.conflictCount])).toEqual([
      ['a-touching||b-standard', 1],
      ['b-standard||z-overlap', 2],
    ]);
  });

  it('computes preference metrics before applying their comparator keys', () => {
    const halfDayGroups = [
      makeGroup('A', 'a-busy-afternoon', [
        { weeks: [1, 2], day: 1, periods: [6], room: '', campus: '本部' },
      ]),
      makeGroup('A', 'z-free-afternoon', [
        { weeks: [1, 2], day: 1, periods: [3], room: '', campus: '本部' },
      ]),
    ];
    const afternoonBlocks: string[] = [];
    for (let day = 2; day <= 5; day += 1) {
      for (let period = 6; period <= 13; period += 1) {
        afternoonBlocks.push(`${day}-${period}`);
      }
    }
    expect(enumerateArrangements(halfDayGroups, {
      calculationMode: 'auto',
      arrangementDisplayCount: 8,
      mergeAllTimeGroups: false,
      preferHalfDay: true,
      preferFewerEarlyMornings: false,
      preferAvoidCampusTransfers: false,
      residentCampus: '本部',
      blockedSlots: afternoonBlocks,
    }).map((result) => result.id)).toEqual([
      'z-free-afternoon',
      'a-busy-afternoon',
    ]);

    const earlyGroups = [
      makeGroup('A', 'a-early', [{ weeks: [1, 2], day: 1, periods: [1], room: '', campus: '本部' }]),
      makeGroup('A', 'z-late', [{ weeks: [1, 2], day: 2, periods: [3], room: '', campus: '本部' }]),
    ];
    expect(enumerateArrangements(earlyGroups, {
      calculationMode: 'auto',
      arrangementDisplayCount: 8,
      mergeAllTimeGroups: false,
      preferHalfDay: false,
      preferFewerEarlyMornings: true,
      preferAvoidCampusTransfers: false,
      residentCampus: '本部',
      blockedSlots: [],
    }).map((result) => result.id)).toEqual(['z-late', 'a-early']);
  });

  it('ranks fewer campus transfers ahead of existing preferences when enabled', () => {
    const groups = [
      makeGroup('A', 'a-high-tech', [{
        weeks: [1], day: 1, periods: [1, 2], room: 'GT-A101', campus: '高新区',
      }]),
      makeGroup('A', 'z-main-campus', [{
        weeks: [1], day: 1, periods: [6, 7], room: '1101', campus: '本部',
      }]),
    ];

    expect(enumerateArrangements(groups, {
      ...NO_PREFERENCES,
      preferHalfDay: true,
      preferAvoidCampusTransfers: true,
    }).map((result) => result.id)).toEqual(['z-main-campus', 'a-high-tech']);
  });
});

describe('exact Top-100 conflict-free preview search', () => {
  it('visits the deterministic 4^8 search without retaining the Cartesian product', () => {
    const groups: CourseGroup[] = [];
    for (let courseIndex = 0; courseIndex < 8; courseIndex += 1) {
      for (let candidateIndex = 0; candidateIndex < 4; candidateIndex += 1) {
        groups.push(makeGroup(
          `C${courseIndex}`,
          `C${courseIndex}::candidate-${candidateIndex}`,
        ));
      }
    }
    const diagnostics: ArrangementSearchDiagnostics = {
      precomputedGroupCount: 0,
      visitedLeaves: 0,
      maxDepth: 0,
      maxRetainedCandidates: 0,
    };

    const results = enumerateArrangementsExact(groups, NO_PREFERENCES, diagnostics);

    expect(results).toHaveLength(8);
    expect(diagnostics.precomputedGroupCount).toBe(32);
    expect(diagnostics.visitedLeaves).toBe(4 ** 8);
    expect(diagnostics.maxDepth).toBe(8);
    expect(diagnostics.maxRetainedCandidates).toBe(100);
    expect(diagnostics.maxRetainedCandidates).toBeLessThan(diagnostics.visitedLeaves);
  });
});
