import { useMemo } from 'react';
import { courses } from '@/data';
import type { CourseSection, FilterState } from '@/types';

export function useFilteredCourses(filter: FilterState): CourseSection[] {
  return useMemo(() => {
    const kw = filter.keyword.trim().toLowerCase();
    return courses.filter((c) => {
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
  }, [filter]);
}
