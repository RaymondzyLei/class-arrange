import { useMemo } from 'react';
import { courses } from '@/data';
import type { CourseGroup, FilterState } from '@/types';
import { buildCourseGroups } from '@/utils/courseGroup';

/** 按筛选条件过滤课程并聚合成选课单元 */
export function useFilteredCourses(filter: FilterState): CourseGroup[] {
  return useMemo(() => {
    const kw = filter.keyword.trim().toLowerCase();
    const filtered = courses.filter((c) => {
      if (kw) {
        const hit =
          c.courseName.toLowerCase().includes(kw) ||
          c.id.toLowerCase().includes(kw) ||
          c.teacher.toLowerCase().includes(kw);
        if (!hit) return false;
      }
      if (filter.department && c.department.name !== filter.department) return false;
      if (filter.courseType && c.courseType !== filter.courseType) return false;
      if (filter.sectionType && c.sectionType !== filter.sectionType) return false;
      if (filter.examType && c.examType !== filter.examType) return false;
      if (filter.language && c.language !== filter.language) return false;
      return true;
    });
    return buildCourseGroups(filtered);
  }, [filter]);
}
