import { describe, expect, it } from 'vitest';
import type { CourseGroup, CourseSection, ScheduleSlot } from '@/types';
import * as courseGroup from './courseGroup';

const { buildCourseGroups, scheduleFingerprint } = courseGroup;

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

  it('treats contiguous source ranges as the same weekly occupancy', () => {
    const split = [
      { weeks: [1, 9], room: '5103', campus: '本部', day: 4, periods: [3, 4, 5] },
      { weeks: [10, 18], room: '5103', campus: '本部', day: 4, periods: [3, 4, 5] },
    ] satisfies ScheduleSlot[];
    const continuous = [
      { weeks: [1, 18], room: '5104', campus: '本部', day: 4, periods: [3, 4, 5] },
    ] satisfies ScheduleSlot[];

    expect(scheduleFingerprint(split)).toBe(scheduleFingerprint(continuous));

    const splitSection = { ...section('STAT2002.01', '陈昱,张伟平', 4), schedule: split };
    const continuousSection = { ...section('STAT2002.02', '王占锋', 4), schedule: continuous };
    const groups = buildCourseGroups([splitSection, continuousSection]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sectionIds).toEqual(['STAT2002.01', 'STAT2002.02']);
  });

  it('does not merge schedules when a source range leaves a week unoccupied', () => {
    const withGap = [
      { weeks: [1, 9], room: '5103', campus: '本部', day: 4, periods: [3, 4, 5] },
      { weeks: [11, 18], room: '5103', campus: '本部', day: 4, periods: [3, 4, 5] },
    ] satisfies ScheduleSlot[];
    const continuous = [
      { weeks: [1, 18], room: '5104', campus: '本部', day: 4, periods: [3, 4, 5] },
    ] satisfies ScheduleSlot[];

    expect(scheduleFingerprint(withGap)).not.toBe(scheduleFingerprint(continuous));
  });
});

function section(id: string, teacher: string, day: number): CourseSection {
  return {
    id,
    courseName: id.startsWith('001101') ? '线性代数' : '大学物理',
    department: { code: '01', name: '数学科学学院' },
    teacher,
    credits: 4,
    hours: 64,
    level: '',
    sectionType: '',
    category: '',
    courseType: '',
    language: '',
    examType: '',
    grading: '',
    undergradShared: false,
    enrolled: 0,
    capacity: 100,
    classes: [],
    rawSchedule: '',
    schedule: [{ weeks: [1, 16], room: '1101', campus: '本部', day, periods: [1, 2] }],
  };
}

describe('merged course time-group display', () => {
  it('keeps one display group per course and retains its source time groups', () => {
    const mergeCourseTimeGroups = (
      courseGroup as typeof courseGroup & {
        mergeCourseTimeGroups?: (groups: CourseGroup[]) => CourseGroup[];
      }
    ).mergeCourseTimeGroups;
    expect(mergeCourseTimeGroups).toBeTypeOf('function');
    if (!mergeCourseTimeGroups) return;

    const groups = buildCourseGroups([
      section('001101.01', '张老师', 1),
      section('001101.02', '李老师', 2),
      section('001102.01', '王老师', 3),
    ]);
    const merged = mergeCourseTimeGroups(groups);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      key: '001101::all-time-groups',
      courseCode: '001101',
      sectionIds: ['001101.01', '001101.02'],
      teachers: ['张老师', '李老师'],
    });
    expect(merged[0].timeGroups).toHaveLength(2);
    expect(merged[0].timeGroups?.map((group) => group.schedule[0].day)).toEqual([1, 2]);
    expect(merged[1]).toBe(groups[2]);
  });
});
