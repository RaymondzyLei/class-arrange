import type { CourseSection } from '@/types';

export interface CourseFilterOptions {
  departments: string[];
  courseTypes: string[];
  sectionTypes: string[];
  examTypes: string[];
  gradings: string[];
  languages: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'));
}

export function buildCourseFilterOptions(courses: CourseSection[]): CourseFilterOptions {
  return {
    departments: unique(courses.map((course) => course.department.name)),
    courseTypes: unique(courses.map((course) => course.courseType)),
    sectionTypes: unique(courses.map((course) => course.sectionType)),
    examTypes: unique(courses.map((course) => course.examType)),
    gradings: unique(courses.map((course) => course.grading)),
    languages: unique(courses.map((course) => course.language)),
  };
}
