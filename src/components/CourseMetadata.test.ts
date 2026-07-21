import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CourseGroup, CourseSection } from '@/types';
import CoursePoolItem from './CoursePoolItem';

function section(): CourseSection {
  return {
    id: 'ARTS6001.01',
    courseName: '电影中的音乐',
    department: { code: 'ART', name: '艺术教学中心' },
    teacher: '教师甲',
    credits: 3,
    hours: 48,
    level: '研究生',
    sectionType: '计划内',
    category: '艺术类',
    courseType: '理论课',
    language: '中文',
    examType: '考查',
    grading: '百分制',
    undergradShared: false,
    enrolled: 10,
    capacity: 30,
    classes: [],
    rawSchedule: '',
    schedule: [],
  };
}

describe('course metadata presentation', () => {
  it('shows department, education level, and credits without course category', () => {
    const course = section();
    const group: CourseGroup = {
      key: 'ARTS6001::',
      courseCode: 'ARTS6001',
      courseName: course.courseName,
      schedule: [],
      fingerprint: '',
      sectionIds: [course.id],
      teachers: [course.teacher],
      sections: [course],
    };

    const html = renderToStaticMarkup(createElement(CoursePoolItem, {
      group,
      groupSelected: false,
      courseSelected: false,
      conflicting: false,
      theme: 'light',
      favoriteIds: new Set<string>(),
      toggleFavorite: vi.fn(),
      tourFavorite: false,
      onToggleGroup: vi.fn(),
      onToggleCourse: vi.fn(),
      onOpenDetail: vi.fn(),
    }));

    expect(html).toContain('艺术教学中心 · 研究生 · 3学分');
    expect(html).not.toContain('艺术类');
  });
});
