import { describe, expect, it } from 'vitest';
import type { CourseGroup, ScheduleSlot } from '@/types';
import { scheduleFingerprint } from './courseGroup';
import {
  blockedConflictGroupSet,
  conflictGroupSet,
  detectConflicts,
} from './conflict';
import { formatScheduleCompact } from './scheduleFormat';

function slot(overrides: Partial<ScheduleSlot> & Record<string, unknown>): ScheduleSlot {
  return {
    weeks: [1, 4],
    room: '',
    day: 1,
    periods: [11],
    ...overrides,
  } as ScheduleSlot;
}

function group(key: string, schedule: ScheduleSlot[]): CourseGroup {
  return {
    courseCode: key,
    courseName: key,
    schedule,
    fingerprint: key,
    sectionIds: [`${key}.01`],
    teachers: [],
    sections: [],
    key,
  };
}

describe('precise clock schedules', () => {
  it('keeps groups with the same approximate periods but different clock times distinct', () => {
    const first = scheduleFingerprint([
      slot({ startTime: '19:00', endTime: '19:30' }),
    ]);
    const second = scheduleFingerprint([
      slot({ startTime: '19:15', endTime: '19:45' }),
    ]);
    const standard = scheduleFingerprint([slot({})]);

    expect(first).not.toBe(second);
    expect(first).not.toBe(standard);
  });

  it('formats exact clock times instead of their approximate grid periods', () => {
    const formatted = formatScheduleCompact([
      slot({ day: 2, startTime: '19:00', endTime: '19:30' }),
    ]);

    expect(formatted).toContain('2(19:00~19:30)');
    expect(formatted).not.toContain('2(11)');
  });

  it('collapses a single-week closed interval in compact course details', () => {
    const formatted = formatScheduleCompact([
      slot({ weeks: [7, 7], day: 6, periods: [3, 4, 5] }),
    ]);

    expect(formatted).toContain('7周');
    expect(formatted).not.toContain('7~7周');
  });

  it('does not report an endpoint-touching exact course against period 11', () => {
    const exact = group('exact', [
      slot({ startTime: '19:00', endTime: '19:30' }),
    ]);
    const standard = group('standard', [slot({})]);

    expect(detectConflicts([exact, standard]).size).toBe(0);
  });

  it('reports a real minute overlap even when the approximate periods differ', () => {
    const exact = group('exact', [
      slot({ periods: [10], startTime: '19:15', endTime: '19:45' }),
    ]);
    const standard = group('standard', [slot({ periods: [11] })]);

    expect(conflictGroupSet(detectConflicts([exact, standard]))).toEqual(
      new Set(['exact', 'standard']),
    );
  });

  it('compares exact courses with blocked grid periods by minute interval', () => {
    const touching = group('touching', [
      slot({ startTime: '19:00', endTime: '19:30' }),
    ]);
    const overlapping = group('overlapping', [
      slot({ periods: [10], startTime: '19:15', endTime: '19:45' }),
    ]);

    expect(blockedConflictGroupSet([touching, overlapping], ['1-11'])).toEqual(
      new Set(['overlapping']),
    );
  });
});
