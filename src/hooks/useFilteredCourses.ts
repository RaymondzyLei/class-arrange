import { useMemo } from 'react';
import { courses } from '@/data';
import type { CourseGroup, CourseSection, FilterState } from '@/types';
import { buildCourseGroups, getAllCourseGroups } from '@/utils/courseGroup';

function isEmptyFilter(f: FilterState): boolean {
  return (
    f.keyword === '' &&
    f.department === '' &&
    f.courseType === '' &&
    f.sectionType === '' &&
    f.examType === '' &&
    f.language === ''
  );
}

/** 按筛选条件过滤课程并聚合成选课单元 */
export function useFilteredCourses(filter: FilterState): CourseGroup[] {
  return useMemo(() => {
    if (isEmptyFilter(filter)) return getAllCourseGroups();
    const kw = filter.keyword.trim().toLowerCase();
    const filtered: CourseSection[] = [];
    for (const c of courses) {
      if (kw) {
        const cn = c.courseName.toLowerCase();
        const cid = c.id.toLowerCase();
        const ct = c.teacher.toLowerCase();
        if (!cn.includes(kw) && !cid.includes(kw) && !ct.includes(kw)) continue;
      }
      if (filter.department && c.department.name !== filter.department) continue;
      if (filter.courseType && c.courseType !== filter.courseType) continue;
      if (filter.sectionType && c.sectionType !== filter.sectionType) continue;
      if (filter.examType && c.examType !== filter.examType) continue;
      if (filter.language && c.language !== filter.language) continue;
      filtered.push(c);
    }
    return buildCourseGroups(filtered);
  }, [filter]);
}
