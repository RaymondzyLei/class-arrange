import { describe, expect, it } from 'vitest';
import type { Campus, CourseGroup, ScheduleSlot } from '@/types';
import { countCampusTransfers } from './campusTransfers';

function group(
  key: string,
  campus: Campus,
  periods: number[],
  weeks: number[] = [1],
  day = 1,
): CourseGroup {
  const schedule: ScheduleSlot[] = [{
    weeks,
    room: key,
    campus,
    day,
    periods,
  }];
  return {
    courseCode: key,
    courseName: key,
    schedule,
    fingerprint: key,
    sectionIds: [],
    teachers: [],
    sections: [],
    key,
  };
}

describe('campus transfer count', () => {
  it('matches the clarified resident-campus examples across independent day bands', () => {
    const morningHigh = group('morning-high', '高新区', [1, 2]);
    const morningMain = group('morning-main', '本部', [3, 4]);
    const afternoonHigh = group('afternoon-high', '高新区', [6, 7]);
    const afternoonMain = group('afternoon-main', '本部', [6, 7]);
    const eveningMain = group('evening-main', '本部', [11, 12, 13]);

    expect(countCampusTransfers([morningHigh, morningMain], '本部')).toBe(2);
    expect(countCampusTransfers(
      [morningHigh, morningMain, afternoonHigh],
      '本部',
    )).toBe(3);
    expect(countCampusTransfers(
      [morningHigh, morningMain, afternoonMain],
      '高新区',
    )).toBe(2);
    expect(countCampusTransfers(
      [morningHigh, morningMain, afternoonMain, eveningMain],
      '高新区',
    )).toBe(3);
  });

  it('counts every actual teaching week and keeps days and bands independent', () => {
    const twoWeekMorning = [
      group('high', '高新区', [1, 2], [1, 2]),
      group('main', '本部', [3, 4], [1, 2]),
    ];
    expect(countCampusTransfers(twoWeekMorning, '本部')).toBe(4);

    expect(countCampusTransfers([
      group('monday-high', '高新区', [1, 2], [1], 1),
      group('tuesday-main', '本部', [3, 4], [1], 2),
      group('monday-other-afternoon', '其他', [6, 7], [1], 1),
    ], '本部')).toBe(2);
  });
});
