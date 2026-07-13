import { describe, expect, it } from 'vitest';
import type { CourseGroup, CourseSection, ScheduleSlot } from '@/types';
import type { CustomScheduleSettings } from './customization';
import { enumerateArrangements } from './arrangement';
import {
  compareArrangementRanks,
  enumerateArrangementsExact,
  type ArrangementRank,
  type ArrangementSearchDiagnostics,
} from './arrangementEngine';
import { enumerateArrangementsOracle } from './arrangementOracle';

const NO_PREFERENCES: CustomScheduleSettings = {
  calculationMode: 'auto',
  preferHalfDay: false,
  preferFewerEarlyMornings: false,
  blockedSlots: [],
};

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
    conflictCount: 0,
    halfDayScore: 0,
    earlyMorningDayCount: 0,
    keyString: 'same',
    totalCredits: 0,
    ...overrides,
  };
}

describe('compareArrangementRanks', () => {
  it('applies the exact conflict, half-day, early-morning, key, and credit ordering', () => {
    const allPreferences: CustomScheduleSettings = {
      calculationMode: 'auto',
      preferHalfDay: true,
      preferFewerEarlyMornings: true,
      blockedSlots: [],
    };

    expect(compareArrangementRanks(
      makeRank({ conflictCount: 0, keyString: 'z' }),
      makeRank({ conflictCount: 1, keyString: 'a' }),
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
      makeRank({ halfDayScore: 0, earlyMorningDayCount: 7, keyString: 'a' }),
      makeRank({ halfDayScore: 2, earlyMorningDayCount: 0, keyString: 'b' }),
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

describe('exact Top-8 differential contract', () => {
  it('matches every oracle field and result position for seeded small inputs', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const groups = randomGroups(seed);
      for (const preferHalfDay of [false, true]) {
        for (const preferFewerEarlyMornings of [false, true]) {
          const settings: CustomScheduleSettings = {
            calculationMode: 'auto',
            preferHalfDay,
            preferFewerEarlyMornings,
            blockedSlots: blockedSlotsForSeed(seed),
          };
          const expected = enumerateArrangementsOracle(groups, settings);
          const actual = enumerateArrangements(groups, settings);
          expect(
            actual,
            `seed=${seed}, halfDay=${preferHalfDay}, early=${preferFewerEarlyMornings}`,
          ).toEqual(expected);
        }
      }
    }
  });

  it('counts blocked-slot hits without conflating them with timetable overlaps', () => {
    const groups = [
      makeGroup('A', 'a-blocked', [{ weeks: [1, 2], day: 1, periods: [1], room: '' }]),
      makeGroup('A', 'z-free', [{ weeks: [1, 2], day: 2, periods: [3], room: '' }]),
      makeGroup('B', 'b-locked', [{ weeks: [1, 2], day: 4, periods: [4], room: '' }]),
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
        startTime: '19:00',
        endTime: '19:30',
      } as ScheduleSlot]),
      makeGroup('A', 'z-overlap', [{
        weeks: [1, 2],
        day: 1,
        periods: [10],
        room: '',
        startTime: '19:15',
        endTime: '19:45',
      } as ScheduleSlot]),
      makeGroup('B', 'b-standard', [{
        weeks: [1, 2],
        day: 1,
        periods: [11],
        room: '',
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
        { weeks: [1, 2], day: 1, periods: [6], room: '' },
      ]),
      makeGroup('A', 'z-free-afternoon', [
        { weeks: [1, 2], day: 1, periods: [3], room: '' },
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
      preferHalfDay: true,
      preferFewerEarlyMornings: false,
      blockedSlots: afternoonBlocks,
    }).map((result) => result.id)).toEqual([
      'z-free-afternoon',
      'a-busy-afternoon',
    ]);

    const earlyGroups = [
      makeGroup('A', 'a-early', [{ weeks: [1, 2], day: 1, periods: [1], room: '' }]),
      makeGroup('A', 'z-late', [{ weeks: [1, 2], day: 2, periods: [3], room: '' }]),
    ];
    expect(enumerateArrangements(earlyGroups, {
      calculationMode: 'auto',
      preferHalfDay: false,
      preferFewerEarlyMornings: true,
      blockedSlots: [],
    }).map((result) => result.id)).toEqual(['z-late', 'a-early']);
  });
});

describe('exact Top-8 bounded search', () => {
  it('visits a deterministic 4^8 search without retaining the Cartesian product', () => {
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
    expect(diagnostics.maxRetainedCandidates).toBe(8);
    expect(diagnostics.maxRetainedCandidates).toBeLessThan(diagnostics.visitedLeaves);
  });
});
