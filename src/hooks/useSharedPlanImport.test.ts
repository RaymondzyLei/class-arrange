import { describe, expect, it } from 'vitest';
import type { CourseSection, Plan } from '@/types';
import type { SharedPlanPayload } from '@/utils/sharedPlan';
import { deriveSharedPlanPreview } from './useSharedPlanImport';

const payload: SharedPlanPayload = {
  version: 1,
  semesterKey: '2026-fall',
  name: '无早八',
  courseIds: ['A.01', 'MISSING.01'],
};

function course(id: string, courseName: string): CourseSection {
  return {
    id,
    courseName,
    department: { code: 'MATH', name: '数学科学学院' },
    teacher: '教师',
    credits: 4,
    hours: 80,
    level: '本科',
    sectionType: '主修',
    category: '专业',
    courseType: '必修',
    language: '中文',
    examType: '闭卷',
    grading: '百分制',
    undergradShared: false,
    enrolled: 1,
    capacity: 100,
    classes: [],
    rawSchedule: '',
    schedule: [],
  };
}

function plan(id: string, name: string, courseIds: string[]): Plan {
  return { id, name, createdAt: 1, updatedAt: 1, courseIds };
}

describe('deriveSharedPlanPreview', () => {
  const courseMap = new Map([
    ['A.01', course('A.01', '高等数学')],
  ]);

  it('separates valid and missing course IDs in shared order', () => {
    const preview = deriveSharedPlanPreview(payload, courseMap, []);

    expect(preview.validCourses.map((item) => item.id)).toEqual(['A.01']);
    expect(preview.missingCourseIds).toEqual(['MISSING.01']);
    expect(preview.canImport).toBe(true);
    expect(preview.blockReason).toBeNull();
  });

  it('blocks import when every course is missing', () => {
    const preview = deriveSharedPlanPreview(
      { ...payload, courseIds: ['MISSING.01'] },
      new Map(),
      [],
    );

    expect(preview.validCourses).toEqual([]);
    expect(preview.canImport).toBe(false);
    expect(preview.blockReason).toContain('全部失效');
  });

  it('blocks an eleventh plan', () => {
    const plans = Array.from(
      { length: 10 },
      (_, index) => plan(String(index), `P${index}`, ['A.01']),
    );

    const preview = deriveSharedPlanPreview(payload, courseMap, plans);

    expect(preview.canImport).toBe(false);
    expect(preview.blockReason).toContain('10 个方案');
  });

  it('allows import by reusing the only empty plan', () => {
    const preview = deriveSharedPlanPreview(
      payload,
      courseMap,
      [plan('1', '自定义空白名称', [])],
    );

    expect(preview.canImport).toBe(true);
    expect(preview.reusesEmptyPlan).toBe(true);
    expect(preview.importName).toBe('无早八');
  });

  it('calculates the imported name against retained plans', () => {
    const preview = deriveSharedPlanPreview(
      { ...payload, name: '无早八' },
      courseMap,
      [plan('1', '无早八', ['A.01'])],
    );

    expect(preview.reusesEmptyPlan).toBe(false);
    expect(preview.importName).toBe('无早八 副本');
  });
});
