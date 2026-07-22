import { describe, expect, it } from 'vitest';
import {
  coalesceScheduleSlots,
  formatActiveWeeks,
  type ScheduleDisplaySource,
} from './scheduleDisplay';

function slot(
  weeks: number[],
  overrides: Partial<ScheduleDisplaySource> = {},
): ScheduleDisplaySource {
  return {
    weeks,
    room: '5103',
    campus: '本部',
    day: 5,
    periods: [8, 9, 10],
    ...overrides,
  };
}

describe('schedule display coalescing', () => {
  it('unions contiguous and overlapping source ranges with one time-location signature', () => {
    const result = coalesceScheduleSlots([
      slot([10, 18]),
      slot([1, 9]),
      slot([6, 12]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].activeWeeks).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    expect(formatActiveWeeks(result[0].activeWeeks)).toBe('1~18周');
  });

  it('keeps week gaps while displaying one item for the same time and location', () => {
    const result = coalesceScheduleSlots([
      slot([2, 3]),
      slot([18, 18]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].activeWeeks).toEqual([2, 3, 18]);
    expect(formatActiveWeeks(result[0].activeWeeks)).toBe('2~3周、18周');
    expect(result[0].activeWeeks).not.toContain(4);
  });

  it('formats explicit odd/even weeks and two disjoint singleton weeks without filling gaps', () => {
    expect(formatActiveWeeks([1, 3, 5, 7])).toBe('1~7周(单)');
    expect(formatActiveWeeks([2, 4, 6, 8])).toBe('2~8周(双)');
    expect(formatActiveWeeks([2, 18])).toBe('2周、18周');
  });

  it('keeps different time or location signatures separate', () => {
    const result = coalesceScheduleSlots([
      slot([1, 9]),
      slot([10, 18], { room: '5104' }),
      slot([10, 18], { campus: '高新区' }),
      slot([10, 18], { day: 4 }),
      slot([10, 18], { periods: [6, 7] }),
      slot([10, 18], { startTime: '19:00', endTime: '19:30' }),
    ]);

    expect(result).toHaveLength(6);
  });

  it('keeps unspecified weeks distinct from known weeks and deduplicates unspecified slots', () => {
    const result = coalesceScheduleSlots([
      slot([]),
      slot([]),
      slot([2, 3]),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.weeksSpecified)).toEqual([true, false]);
    expect(result.map((item) => item.activeWeeks)).toEqual([[2, 3], []]);
  });

  it('normalizes period order deterministically without mutating source data', () => {
    const source = [
      slot([18, 18], { periods: [10, 8, 9, 8] }),
      slot([2, 3], { periods: [9, 10, 8] }),
    ];
    const snapshot = structuredClone(source);

    const first = coalesceScheduleSlots(source);
    const second = coalesceScheduleSlots([...source].reverse());

    expect(first).toEqual(second);
    expect(first[0].periods).toEqual([8, 9, 10]);
    expect(source).toEqual(snapshot);
  });
});
