import type { CourseSection, ScheduleSlot } from '@/types';
import { isWeekInArray } from './weeks';

export interface GridEntry {
  courseId: string;
  slot: ScheduleSlot;
}

export interface GridCell {
  day: number;
  period: number;
  entries: GridEntry[];
}

export const DAY_COUNT = 7;
export const PERIOD_COUNT = 13;

/** 把一组课程在指定周次上映射为 7×13 网格 */
export function buildWeekGrid(sections: CourseSection[], week: number): GridCell[][] {
  const grid: GridCell[][] = Array.from({ length: DAY_COUNT }, (_, d) =>
    Array.from({ length: PERIOD_COUNT }, (_, p) => ({
      day: d + 1,
      period: p + 1,
      entries: [] as GridEntry[],
    })),
  );
  for (const sec of sections) {
    for (const slot of sec.schedule) {
      if (!isWeekInArray(slot.weeks, week)) continue;
      for (const p of slot.periods) {
        if (p < 1 || p > PERIOD_COUNT) continue;
        grid[slot.day - 1][p - 1].entries.push({ courseId: sec.id, slot });
      }
    }
  }
  return grid;
}
