import { useMemo } from 'react';
import type { CourseGroup } from '@/types';
import {
  blockedConflictGroupSet,
  detectConflicts,
  conflictGroupSet,
  type ConflictMap,
} from '@/utils/conflict';

/** 返回 groups 内部的冲突信息 */
export function useConflicts(groups: CourseGroup[], blockedSlots: string[] = []): {
  conflicts: ConflictMap;
  conflictGroupKeys: Set<string>;
} {
  return useMemo(() => {
    const conflicts = detectConflicts(groups);
    const conflictGroupKeys = conflictGroupSet(conflicts);
    for (const key of blockedConflictGroupSet(groups, blockedSlots)) {
      conflictGroupKeys.add(key);
    }
    return { conflicts, conflictGroupKeys };
  }, [blockedSlots, groups]);
}
