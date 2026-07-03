import type { CourseGroup } from '@/types';

export interface PlanStats {
  count: number;
  totalCredits: number;
  totalHours: number;
  conflictCount: number;
}

/**
 * 按选课单元统计：count/学分/学时都按 group 计一次（取代表 section），
 * 避免选一个含多班次的组被重复计数。
 */
export function computeStats(groups: CourseGroup[], conflictGroupKeys: Set<string>): PlanStats {
  let totalCredits = 0;
  let totalHours = 0;
  for (const g of groups) {
    const rep = g.sections[0];
    if (!rep) continue;
    totalCredits += rep.credits;
    totalHours += rep.hours;
  }
  return {
    count: groups.length,
    totalCredits,
    totalHours,
    conflictCount: conflictGroupKeys.size,
  };
}
