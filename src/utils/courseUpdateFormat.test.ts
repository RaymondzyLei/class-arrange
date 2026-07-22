import { describe, expect, test } from 'vitest';
import { formatCourseChangeSide } from './courseUpdateFormat';

describe('course update value formatting', () => {
  test('labels an empty schedule and location instead of rendering a blank value', () => {
    expect(formatCourseChangeSide({
      field: 'schedule',
      label: '上课时间与周次',
      before: [],
      after: [],
    }, 'after')).toBe('时间未定');
    expect(formatCourseChangeSide({
      field: 'location',
      label: '上课地点或校区',
      before: [],
      after: [],
    }, 'after')).toBe('地点未定');
  });

  test('coalesces split and gapped week ranges without filling the gap', () => {
    expect(formatCourseChangeSide({
      field: 'schedule',
      label: '上课时间与周次',
      after: [
        { weeks: [8, 9], day: 5, periods: [3, 4, 5] },
        { weeks: [10, 13], day: 5, periods: [3, 4, 5] },
      ],
    }, 'after')).toBe('8~13周 周五 3–5节');

    expect(formatCourseChangeSide({
      field: 'schedule',
      label: '上课时间与周次',
      after: [
        { weeks: [2, 3], day: 5, periods: [8, 9, 10] },
        { weeks: [18, 18], day: 5, periods: [8, 9, 10] },
      ],
    }, 'after')).toBe('2~3周、18周 周五 8–10节');
  });
});
