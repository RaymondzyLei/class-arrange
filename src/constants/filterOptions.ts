import { courses } from '@/data';

function unique(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

export const DEPARTMENT_OPTIONS = unique(courses.map((c) => c.department.name));
export const COURSE_TYPE_OPTIONS = unique(courses.map((c) => c.courseType));
export const SECTION_TYPE_OPTIONS = unique(courses.map((c) => c.sectionType));
export const EXAM_TYPE_OPTIONS = unique(courses.map((c) => c.examType));
export const LANGUAGE_OPTIONS = unique(courses.map((c) => c.language));
