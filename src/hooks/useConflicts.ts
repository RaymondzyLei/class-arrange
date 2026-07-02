import { useMemo } from 'react';
import type { Plan } from '@/types';
import { getCourseById } from '@/data';
import { detectConflicts, conflictCourseSet, type ConflictMap } from '@/utils/conflict';

/** 返回活动方案的冲突信息：conflicts map 与冲突课程 id 集合 */
export function useConflicts(activePlan: Plan | null): {
  conflicts: ConflictMap;
  conflictIds: Set<string>;
} {
  return useMemo(() => {
    if (!activePlan) {
      return { conflicts: new Map(), conflictIds: new Set<string>() };
    }
    const sections = activePlan.courseIds
      .map((id) => getCourseById(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const conflicts = detectConflicts(sections);
    return { conflicts, conflictIds: conflictCourseSet(conflicts) };
  }, [activePlan]);
}
