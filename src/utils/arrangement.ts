import type { Arrangement, CourseGroup } from '@/types';
import {
  DEFAULT_CUSTOM_SETTINGS,
  type CustomScheduleSettings,
} from './customization';
import { enumerateArrangementsExact } from './arrangementEngine';

/**
 * 返回出现 ≥2 次的 courseCode 列表（首次出现顺序）
 * 用于检测"同一门课选了多个 group"的歧义场景
 */
export function findAmbiguousCodes(groups: CourseGroup[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  const order: string[] = [];
  for (const g of groups) {
    if (seen.has(g.courseCode)) {
      if (!dup.has(g.courseCode)) order.push(g.courseCode);
      dup.add(g.courseCode);
    } else {
      seen.add(g.courseCode);
    }
  }
  return order;
}

/**
 * 精确搜索每门课程的时间组选择，并按既有比较契约返回 Top 8。
 *
 * - 输入 groups 已聚合（useMemo 后的 buildCourseGroups 结果）
 * - 无歧义时返回 1 个 Arrangement（唯一视图）
 * - 输入空数组返回 []
 */
export function enumerateArrangements(
  groups: CourseGroup[],
  settings: CustomScheduleSettings = DEFAULT_CUSTOM_SETTINGS,
): Arrangement[] {
  return enumerateArrangementsExact(groups, settings);
}

/** 取列表的第一个作为默认应用方案；空数组返回 null */
export function pickDefaultArrangement(arrs: Arrangement[]): Arrangement | null {
  return arrs[0] ?? null;
}
