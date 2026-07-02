import { courses } from './courses';
import type { CourseSection } from '@/types';

export { courses };

/** 课堂号 -> 课程 的查找表（memo 一次构建） */
export const courseMap: Map<string, CourseSection> = new Map(
  courses.map((c) => [c.id, c]),
);

/** 根据课堂号取课程，找不到返回 undefined */
export function getCourseById(id: string): CourseSection | undefined {
  return courseMap.get(id);
}
