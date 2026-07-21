import { describe, expect, test } from 'vitest';
import type { CourseSection, FilterState } from '@/types';
import { buildCourseFilterOptions } from '@/constants/filterOptions';
import { filterCourses } from './useFilteredCourses';

function course(id: string, category: string, level: string): CourseSection {
  return {
    id,
    courseName: id,
    department: { code: 'TEST', name: '测试学院' },
    teacher: '',
    credits: 2,
    hours: 32,
    level,
    sectionType: '计划内',
    category,
    courseType: '理论课',
    language: '中文',
    examType: '考查',
    grading: '百分制',
    undergradShared: false,
    enrolled: 0,
    capacity: 30,
    classes: [],
    rawSchedule: '',
    schedule: [],
  };
}

const courses = [
  course('UG.01', '专业课', '本科'),
  course('GR.01', '专业课', '研究生'),
  course('BRIDGE.01', '专业课', '本研贯通'),
  course('ART.01', '艺术类', '本科'),
];

function filter(patch: Partial<FilterState>): FilterState {
  return {
    keyword: '',
    includeTeacher: false,
    department: '',
    category: '',
    level: '',
    courseType: '',
    sectionType: '',
    examType: '',
    grading: '',
    language: '',
    ...patch,
  };
}

describe('course category and education level filters', () => {
  test('builds unique non-empty options', () => {
    const options = buildCourseFilterOptions(courses);

    expect(options.categories).toEqual(['艺术类', '专业课']);
    expect(options.levels).toEqual(['本科', '本研贯通', '研究生']);
  });

  test('filters both fields with exact matches', () => {
    expect(filterCourses(courses, filter({ category: '专业课' })).map(({ id }) => id))
      .toEqual(['UG.01', 'GR.01', 'BRIDGE.01']);
    expect(filterCourses(courses, filter({ level: '本科' })).map(({ id }) => id))
      .toEqual(['UG.01', 'ART.01']);
    expect(filterCourses(courses, filter({ category: '专业课', level: '研究生' })).map(({ id }) => id))
      .toEqual(['GR.01']);
    expect(filterCourses(courses, filter({ level: '本研贯通' })).map(({ id }) => id))
      .toEqual(['BRIDGE.01']);
  });
});
