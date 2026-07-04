import type { CourseGroup } from '@/types';

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
