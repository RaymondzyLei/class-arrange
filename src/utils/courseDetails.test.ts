import { describe, expect, it } from 'vitest';
import type { CourseDetail, CourseTextbook } from '@/types';
import { formatCourseMaterialDisplay, formatCourseTextbook } from './courseDetails';

const textbook: CourseTextbook = {
  nameZh: '数学实验教程',
  edition: '第3版',
  author: '示例作者',
  publishingHouse: '示例出版社',
  dates: '2025年8月',
  isbn: '9780000000001',
  publish: true,
};

function makeDetail(patch: Partial<CourseDetail> = {}): CourseDetail {
  return {
    code: '001108.01',
    name: { cn: '数学实验', en: 'Mathematical Experiments' },
    dept: '数学科学学院',
    credit: 2.5,
    hour: 40,
    sem: '2026年秋季学期',
    grading: '百分制',
    examType: '考试',
    discipline: '数学',
    lang: '中文',
    prerequisite: '线性代数',
    legacyTextbook: '旧版教材说明',
    textbooks: [],
    materials: [],
    referenceBooks: '',
    description: { cn: '', en: '' },
    syllabus: '',
    ...patch,
  };
}

describe('course detail material formatting', () => {
  it('formats every non-empty structured textbook field', () => {
    expect(formatCourseTextbook(textbook)).toBe(
      '数学实验教程；版次：第3版；作者：示例作者；出版社：示例出版社；日期：2025年8月；ISBN：9780000000001',
    );
  });

  it('ignores whitespace-only metadata', () => {
    expect(formatCourseTextbook({
      nameZh: '课程讲义',
      edition: '   ',
      author: '',
      publishingHouse: '',
      dates: '',
      isbn: '',
      publish: false,
    })).toBe('课程讲义');
  });

  it('keeps published textbooks and unpublished handouts separate', () => {
    const detail = makeDetail({
      textbooks: [textbook],
      materials: [{
        ...textbook,
        nameZh: '课程讲义',
        edition: '',
        publishingHouse: '',
        dates: '',
        isbn: '',
        publish: false,
      }],
      referenceBooks: '数学实验参考资料',
    });

    expect(formatCourseMaterialDisplay(detail)).toEqual({
      textbooks: '数学实验教程；版次：第3版；作者：示例作者；出版社：示例出版社；日期：2025年8月；ISBN：9780000000001',
      materials: '课程讲义；作者：示例作者',
      referenceBooks: '数学实验参考资料',
    });
  });

  it('does not use legacy textbook text when any structured entry exists', () => {
    const detail = makeDetail({
      textbooks: [],
      materials: [{ ...textbook, nameZh: '教师讲义', publish: false }],
    });

    expect(formatCourseMaterialDisplay(detail)).toEqual({
      textbooks: '—',
      materials: '教师讲义；版次：第3版；作者：示例作者；出版社：示例出版社；日期：2025年8月；ISBN：9780000000001',
      referenceBooks: '—',
    });
  });

  it('falls back to legacy textbook text only when structured data is empty', () => {
    expect(formatCourseMaterialDisplay(makeDetail())).toEqual({
      textbooks: '旧版教材说明',
      materials: '—',
      referenceBooks: '—',
    });
  });

  it('uses em dashes when detail material fields are unavailable', () => {
    expect(formatCourseMaterialDisplay(undefined)).toEqual({
      textbooks: '—',
      materials: '—',
      referenceBooks: '—',
    });
  });
});
