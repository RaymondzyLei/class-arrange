import type { CourseFieldChange, CourseImpactEvent } from '@/types';

export function isDangerousCourseChange(change: CourseFieldChange): boolean {
  return change.field === 'level';
}

export function isDangerousImpact(impact: CourseImpactEvent): boolean {
  return impact.kind === 'removed' || impact.changes.some(isDangerousCourseChange);
}
