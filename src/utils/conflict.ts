import type { CourseGroup } from '@/types';
import { expandWeeks } from './weeks';
import { blockedSlotKey } from './customization';

/** slotKey = `${week}-${day}-${period}` */
export type ConflictMap = Map<string, Set<string>>;

/**
 * 检测一组选课单元之间的时间冲突。
 * 冲突定义：存在某周 w、星期 d、节次 p 被两门及以上**不同选课单元**同时占用。
 *
 * 按 group.key 占用 slotKey：同一选课单元内（同课程号同时间的多个班次）
 * 占同一格不算冲突，消除"同课同时间不同老师"的误报。
 */
export function detectConflicts(groups: CourseGroup[]): ConflictMap {
  const occ = new Map<string, Set<string>>();
  for (const g of groups) {
    for (const slot of g.schedule) {
      for (const w of expandWeeks(slot.weeks)) {
        for (const p of slot.periods) {
          const key = `${w}-${slot.day}-${p}`;
          let set = occ.get(key);
          if (!set) {
            set = new Set<string>();
            occ.set(key, set);
          }
          set.add(g.key);
        }
      }
    }
  }
  const conflicts: ConflictMap = new Map();
  for (const [k, set] of occ) {
    if (set.size >= 2) conflicts.set(k, set);
  }
  return conflicts;
}

/** 返回存在冲突的所有选课单元 key 集合 */
export function conflictGroupSet(conflicts: ConflictMap): Set<string> {
  const s = new Set<string>();
  for (const set of conflicts.values()) {
    for (const key of set) s.add(key);
  }
  return s;
}

/** 返回与用户占位时间相撞的课程组；同一课程撞多个占位仍只计一次。 */
export function blockedConflictGroupSet(
  groups: CourseGroup[],
  blockedSlots: Iterable<string>,
): Set<string> {
  const blocked = blockedSlots instanceof Set ? blockedSlots : new Set(blockedSlots);
  const conflictGroups = new Set<string>();
  if (blocked.size === 0) return conflictGroups;
  for (const group of groups) {
    if (group.schedule.some((slot) =>
      slot.periods.some((period) => blocked.has(blockedSlotKey(slot.day, period))),
    )) {
      conflictGroups.add(group.key);
    }
  }
  return conflictGroups;
}

/** slotKey 是否处于冲突 */
export function isSlotConflicting(conflicts: ConflictMap, week: number, day: number, period: number): boolean {
  return conflicts.has(`${week}-${day}-${period}`);
}
