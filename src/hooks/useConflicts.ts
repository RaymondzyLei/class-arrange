import { useMemo } from 'react';
import type { CourseGroup } from '@/types';
import { detectConflicts, conflictGroupSet, type ConflictMap } from '@/utils/conflict';

/** 返回 groups 内部的冲突信息 */
export function useConflicts(groups: CourseGroup[]): {
  conflicts: ConflictMap;
  conflictGroupKeys: Set<string>;
} {
  return useMemo(() => {
    const conflicts = detectConflicts(groups);
    return { conflicts, conflictGroupKeys: conflictGroupSet(conflicts) };
  }, [groups]);
}
