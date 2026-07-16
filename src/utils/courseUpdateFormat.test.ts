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
});
