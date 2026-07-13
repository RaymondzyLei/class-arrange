import { courses as legacyCourses } from './courses';
import type { CourseSection } from '@/types';

/** 旧 Excel 数据没有评分制；新学期 JSON 接管前在唯一导出边界补空值。 */
export const courses: CourseSection[] = legacyCourses.map((course) => ({
  ...course,
  grading: '',
}));

/** 课堂号 -> 课程 的查找表（memo 一次构建） */
export const courseMap: Map<string, CourseSection> = new Map(
  courses.map((c) => [c.id, c]),
);

/** 根据课堂号取课程，找不到返回 undefined */
export function getCourseById(id: string): CourseSection | undefined {
  return courseMap.get(id);
}
