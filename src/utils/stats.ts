import type { CourseSection } from '@/types';

export interface PlanStats {
  count: number;
  totalCredits: number;
  totalHours: number;
  conflictCount: number;
}

export function computeStats(sections: CourseSection[], conflictCourseIds: Set<string>): PlanStats {
  let totalCredits = 0;
  let totalHours = 0;
  for (const s of sections) {
    totalCredits += s.credits;
    totalHours += s.hours;
  }
  return {
    count: sections.length,
    totalCredits,
    totalHours,
    conflictCount: conflictCourseIds.size,
  };
}
