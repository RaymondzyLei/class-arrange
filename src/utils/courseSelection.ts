import type { CourseGroup } from '@/types';
import { detectConflicts } from './conflict';

/** Return every section ID represented by one time group, preserving first-seen order. */
export function idsForGroup(group: CourseGroup): string[] {
  return [...new Set(group.sectionIds)];
}

/** Return every section ID from every time group for a course, preserving first-seen order. */
export function idsForCourse(
  courseCode: string,
  groupsByCode: ReadonlyMap<string, CourseGroup[]>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const group of groupsByCode.get(courseCode) ?? []) {
    for (const id of group.sectionIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Summarize existing courses that conflict with at least one group in the requested scope.
 * Alternatives for the same course are excluded because they are not taken simultaneously.
 */
export function conflictingCourseNamesForSelection(
  selectionGroups: readonly CourseGroup[],
  existingGroups: readonly CourseGroup[],
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const existing of existingGroups) {
    if (seen.has(existing.courseName)) continue;
    const conflicts = selectionGroups.some((candidate) =>
      candidate.courseCode !== existing.courseCode
      && detectConflicts([candidate, existing]).size > 0,
    );
    if (!conflicts) continue;
    seen.add(existing.courseName);
    names.push(existing.courseName);
  }
  return names;
}
