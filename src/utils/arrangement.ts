import type { Arrangement, CourseGroup } from '@/types';
import { expandWeeks } from './weeks';

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

/** 用 slotKey 计数冲突，2 个以上不同 group 撞同一 slotKey 算 1 个冲突 group */
function countConflicts(groups: CourseGroup[]): number {
  const occ = new Map<string, Set<string>>();
  for (const g of groups) {
    for (const slot of g.schedule) {
      for (const w of expandWeeks(slot.weeks)) {
        for (const p of slot.periods) {
          const k = `${w}-${slot.day}-${p}`;
          let s = occ.get(k);
          if (!s) {
            s = new Set<string>();
            occ.set(k, s);
          }
          s.add(g.key);
        }
      }
    }
  }
  const seen = new Set<string>();
  for (const s of occ.values()) {
    if (s.size >= 2) for (const k of s) seen.add(k);
  }
  return seen.size;
}

function sumCredits(groups: CourseGroup[]): number {
  let c = 0;
  for (const g of groups) {
    const rep = g.sections[0];
    if (rep) c += rep.credits;
  }
  return c;
}

function sumHours(groups: CourseGroup[]): number {
  let h = 0;
  for (const g of groups) {
    const rep = g.sections[0];
    if (rep) h += rep.hours;
  }
  return h;
}

function arrangementId(groups: CourseGroup[]): string {
  return groups.map((g) => g.key).sort().join('||');
}

/** 笛卡尔积（不依赖外部库，所有 courseCode 的候选 group 全展开） */
function cartesian<T>(lists: T[][]): T[][] {
  if (lists.length === 0) return [[]];
  const [head, ...tail] = lists;
  const out: T[][] = [];
  for (const item of head) {
    for (const rest of cartesian(tail)) {
      out.push([item, ...rest]);
    }
  }
  return out;
}

/**
 * 把已选 groups 拆成 (locked + ambiguousChoicesByCode)，再做笛卡尔积，
 * 给每个组合算 conflictCount / 总学分 / 总学时，按冲突数升序排，取前 8。
 *
 * - 输入 groups 已聚合（useMemo 后的 buildCourseGroups 结果）
 * - 无歧义时返回 1 个 Arrangement（唯一视图）
 * - 输入空数组返回 []
 */
export function enumerateArrangements(groups: CourseGroup[]): Arrangement[] {
  if (groups.length === 0) return [];

  // 按 courseCode 桶
  const byCode = new Map<string, CourseGroup[]>();
  const order: string[] = [];
  for (const g of groups) {
    const arr = byCode.get(g.courseCode);
    if (!arr) {
      byCode.set(g.courseCode, [g]);
      order.push(g.courseCode);
    } else {
      arr.push(g);
    }
  }

  // 拆 locked / ambiguous
  const locked: CourseGroup[] = [];
  const ambiguousChoices: CourseGroup[][] = [];
  for (const code of order) {
    const arr = byCode.get(code)!;
    if (arr.length === 1) locked.push(arr[0]);
    else ambiguousChoices.push(arr);
  }

  // 处理 ambiguous 顺序固定（首次出现）
  const combos = cartesian(ambiguousChoices);

  const arrs: Arrangement[] = combos.map((picked) => {
    const allGroups = [...locked, ...picked];
    return {
      id: arrangementId(allGroups),
      groups: allGroups,
      conflictCount: countConflicts(allGroups),
      courseCount: allGroups.length,
      totalCredits: sumCredits(allGroups),
      totalHours: sumHours(allGroups),
    };
  });

  // 排序：(冲突数 asc, groupKeys 字典序 asc, 总学分 desc) 稳定
  arrs.sort((a, b) => {
    if (a.conflictCount !== b.conflictCount) return a.conflictCount - b.conflictCount;
    const aKeys = a.groups.map((g) => g.key).sort().join('|');
    const bKeys = b.groups.map((g) => g.key).sort().join('|');
    if (aKeys !== bKeys) return aKeys < bKeys ? -1 : 1;
    return b.totalCredits - a.totalCredits;
  });

  return arrs.slice(0, 8);
}

/** 取列表的第一个作为默认应用方案；空数组返回 null */
export function pickDefaultArrangement(arrs: Arrangement[]): Arrangement | null {
  return arrs[0] ?? null;
}
