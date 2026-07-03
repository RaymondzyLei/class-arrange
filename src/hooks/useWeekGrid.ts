import { useMemo } from 'react';
import type { Plan } from '@/types';
import { getCourseById } from '@/data';
import { buildCourseGroups } from '@/utils/courseGroup';
import { buildWeekGrid, type GridCell } from '@/utils/grid';

/** 根据活动方案与当前周构建 7×13 网格 */
export function useWeekGrid(activePlan: Plan | null, week: number): GridCell[][] {
  return useMemo(() => {
    if (!activePlan) return buildWeekGrid([], week);
    const sections = activePlan.courseIds
      .map((id) => getCourseById(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const groups = buildCourseGroups(sections);
    return buildWeekGrid(groups, week);
  }, [activePlan, week]);
}
