import { useMemo } from 'react';
import type { CourseGroup, CourseSection, FilterState } from '@/types';
import { buildCourseGroups } from '@/utils/courseGroup';
import { courseMatchesKeyword } from '@/utils/courseSearch';

function isEmptyFilter(f: FilterState): boolean {
  return (
    f.keyword === '' &&
    f.department === '' &&
    f.courseType === '' &&
    f.sectionType === '' &&
    f.examType === '' &&
    f.grading === '' &&
    f.language === ''
  );
}

/** 按筛选条件过滤课程并聚合成选课单元 */
export function filterCourses(courses: CourseSection[], filter: FilterState): CourseSection[] {
  if (isEmptyFilter(filter)) return courses;
  const keyword = filter.keyword.trim().toLowerCase();
  return courses.filter((course) => {
    if (keyword && !courseMatchesKeyword(course, keyword, filter.includeTeacher)) return false;
    if (filter.department && course.department.name !== filter.department) return false;
    if (filter.courseType && course.courseType !== filter.courseType) return false;
    if (filter.sectionType && course.sectionType !== filter.sectionType) return false;
    if (filter.examType && course.examType !== filter.examType) return false;
    if (filter.grading && course.grading !== filter.grading) return false;
    if (filter.language && course.language !== filter.language) return false;
    return true;
  });
}

export function useFilteredCourses(
  courses: CourseSection[],
  groups: CourseGroup[],
  filter: FilterState,
): CourseGroup[] {
  return useMemo(() => {
    if (isEmptyFilter(filter)) return groups;
    return buildCourseGroups(filterCourses(courses, filter));
  }, [courses, filter, groups]);
}
