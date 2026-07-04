import { useMemo } from 'react';
import type { CourseGroup } from '@/types';
import { buildWeekGrid, type GridCell } from '@/utils/grid';

/** 把已选 groups 渲染为 7×13 网格。输入顺序不影响布局（同 courseCode 同 time 自动合并）。 */
export function useWeekGrid(groups: CourseGroup[], week: number): GridCell[][] {
  return useMemo(() => buildWeekGrid(groups, week), [groups, week]);
}
