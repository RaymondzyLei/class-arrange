import { describe, expect, it } from 'vitest';
import type { ScheduleSlot } from '@/types';
import { scheduleFingerprint } from './courseGroup';

function slot(room: string, campus: ScheduleSlot['campus']): ScheduleSlot {
  return {
    weeks: [1, 16],
    room,
    campus,
    day: 1,
    periods: [1, 2],
  };
}

describe('course schedule grouping fingerprint', () => {
  it('ignores exact rooms within one campus but separates different campuses', () => {
    expect(scheduleFingerprint([slot('第一教学楼101', '本部')]))
      .toBe(scheduleFingerprint([slot('第五教学楼202', '本部')]));
    expect(scheduleFingerprint([slot('第一教学楼101', '本部')]))
      .not.toBe(scheduleFingerprint([slot('GT-B102', '高新区')]));
  });
});
