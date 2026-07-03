import type { CourseGroup, ScheduleSlot } from '@/types';
import { isWeekInArray } from './weeks';

export interface GridEntry {
  /** 选课单元 key（同组多班次合并后只剩一个 entry） */
  groupKey: string;
  /** 课程名，渲染时直接取用，避免再回查 */
  courseName: string;
  /** 是否为多班组（同课程号 + 同时间 > 1 个班次折叠而来） */
  isMultiSection: boolean;
  slot: ScheduleSlot;
}

export interface GridCell {
  day: number;
  period: number;
  entries: GridEntry[];
}

export const DAY_COUNT = 7;
export const PERIOD_COUNT = 13;

/** 把一组选课单元在指定周次上映射为 7×13 网格 */
export function buildWeekGrid(groups: CourseGroup[], week: number): GridCell[][] {
  const grid: GridCell[][] = Array.from({ length: DAY_COUNT }, (_, d) =>
    Array.from({ length: PERIOD_COUNT }, (_, p) => ({
      day: d + 1,
      period: p + 1,
      entries: [] as GridEntry[],
    })),
  );
  for (const g of groups) {
    for (const slot of g.schedule) {
      if (!isWeekInArray(slot.weeks, week)) continue;
      for (const p of slot.periods) {
        if (p < 1 || p > PERIOD_COUNT) continue;
        const cell = grid[slot.day - 1][p - 1];
        // 同一选课单元在同一格只放一个 entry（去重）
        if (cell.entries.some((e) => e.groupKey === g.key)) continue;
        cell.entries.push({
          groupKey: g.key,
          courseName: g.courseName,
          isMultiSection: g.sections.length > 1,
          slot,
        });
      }
    }
  }
  return grid;
}
