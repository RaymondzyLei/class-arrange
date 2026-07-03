import { useMemo } from 'react';
import type { Plan } from '@/types';
import { getCourseById } from '@/data';
import { buildCourseGroups } from '@/utils/courseGroup';
import { detectConflicts, conflictGroupSet, type ConflictMap } from '@/utils/conflict';

/** 返回活动方案的冲突信息：conflicts map 与冲突选课单元 key 集合 */
export function useConflicts(activePlan: Plan | null): {
  conflicts: ConflictMap;
  conflictGroupKeys: Set<string>;
} {
  return useMemo(() => {
    if (!activePlan) {
      return { conflicts: new Map(), conflictGroupKeys: new Set<string>() };
    }
    const sections = activePlan.courseIds
      .map((id) => getCourseById(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const groups = buildCourseGroups(sections);
    const conflicts = detectConflicts(groups);
    return { conflicts, conflictGroupKeys: conflictGroupSet(conflicts) };
  }, [activePlan]);
}
