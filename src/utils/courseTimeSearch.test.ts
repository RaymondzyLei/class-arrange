import { describe, expect, it } from 'vitest';
import type { CourseGroup, ScheduleSlot } from '@/types';
import {
  courseGroupMatchesTimeSelection,
  courseTimeSlotKeys,
  filterCourseGroupsByTime,
} from './courseTimeSearch';

function scheduleSlot(
  day: number,
  periods: number[],
  overrides: Partial<ScheduleSlot> = {},
): ScheduleSlot {
  return {
    weeks: [1, 18],
    room: '',
    campus: '本部',
    day,
    periods,
    ...overrides,
  };
}

function courseGroup(key: string, schedule: ScheduleSlot[]): CourseGroup {
  return {
    key,
    courseCode: key,
    courseName: `Course ${key}`,
    schedule,
    fingerprint: key,
    sectionIds: [`${key}.01`],
    teachers: [],
    sections: [],
  };
}

describe('course time-slot extraction', () => {
  it('collects unique day-period keys across every schedule slot and week range', () => {
    const group = courseGroup('MULTI', [
      scheduleSlot(1, [1, 2, 2], { weeks: [1, 8] }),
      scheduleSlot(3, [5], { weeks: [9, 16] }),
      scheduleSlot(1, [2], { weeks: [17, 18] }),
    ]);

    expect([...courseTimeSlotKeys(group)].sort()).toEqual(['1-1', '1-2', '3-5']);
  });

  it('uses raw periods even when exact clock times cross a standard-period boundary', () => {
    const group = courseGroup('EXACT', [
      scheduleSlot(4, [10], {
        startTime: '19:15',
        endTime: '19:45',
      }),
    ]);

    expect([...courseTimeSlotKeys(group)]).toEqual(['4-10']);
    expect(courseGroupMatchesTimeSelection(group, new Set(['4-10']), 'contains')).toBe(true);
    expect(courseGroupMatchesTimeSelection(group, new Set(['4-11']), 'contains')).toBe(false);
  });
});

describe('course time selection modes', () => {
  const multiSlotGroup = courseGroup('MULTI', [
    scheduleSlot(1, [1, 2]),
    scheduleSlot(3, [5]),
  ]);

  it('matches contains mode when any selected slot intersects the course', () => {
    expect(courseGroupMatchesTimeSelection(
      multiSlotGroup,
      new Set(['1-1', '2-2']),
      'contains',
    )).toBe(true);
    expect(courseGroupMatchesTimeSelection(
      multiSlotGroup,
      new Set(['2-2', '4-4']),
      'contains',
    )).toBe(false);
  });

  it('matches within mode only when a non-empty course lies entirely inside the selection', () => {
    expect(courseGroupMatchesTimeSelection(
      multiSlotGroup,
      new Set(['1-1', '1-2', '2-4', '3-5']),
      'within',
    )).toBe(true);
    expect(courseGroupMatchesTimeSelection(
      multiSlotGroup,
      new Set(['1-1', '3-5']),
      'within',
    )).toBe(false);
  });

  it('never matches an empty course schedule for a non-empty selection', () => {
    const emptyGroup = courseGroup('EMPTY', []);

    expect([...courseTimeSlotKeys(emptyGroup)]).toEqual([]);
    expect(courseGroupMatchesTimeSelection(
      emptyGroup,
      new Set(['1-1']),
      'contains',
    )).toBe(false);
    expect(courseGroupMatchesTimeSelection(
      emptyGroup,
      new Set(['1-1']),
      'within',
    )).toBe(false);
  });

  it('filters groups in their original order for each mode', () => {
    const containsAndOutside = courseGroup('A', [scheduleSlot(1, [1]), scheduleSlot(2, [2])]);
    const exactWithin = courseGroup('B', [scheduleSlot(1, [1])]);
    const unrelated = courseGroup('C', [scheduleSlot(4, [4])]);
    const groups = [containsAndOutside, exactWithin, unrelated];
    const selected = new Set(['1-1']);

    expect(filterCourseGroupsByTime(groups, selected, 'contains'))
      .toEqual([containsAndOutside, exactWithin]);
    expect(filterCourseGroupsByTime(groups, selected, 'within'))
      .toEqual([exactWithin]);
  });
});
