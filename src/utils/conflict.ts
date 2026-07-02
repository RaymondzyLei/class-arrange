import type { CourseSection } from '@/types';
import { expandWeeks } from './weeks';

/** slotKey = `${week}-${day}-${period}` */
export type ConflictMap = Map<string, Set<string>>;

/**
 * 检测一组课程之间的时间冲突。
 * 冲突定义：存在某周 w、星期 d、节次 p 被两门及以上不同课程同时占用。
 * 同一课程多 slot 占用同一格不算冲突（Set 去重）。
 */
export function detectConflicts(sections: CourseSection[]): ConflictMap {
  const occ = new Map<string, Set<string>>();
  for (const sec of sections) {
    for (const slot of sec.schedule) {
      for (const w of expandWeeks(slot.weeks)) {
        for (const p of slot.periods) {
          const key = `${w}-${slot.day}-${p}`;
          let set = occ.get(key);
          if (!set) {
            set = new Set<string>();
            occ.set(key, set);
          }
          set.add(sec.id);
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

/** 返回存在冲突的所有课程 id 集合 */
export function conflictCourseSet(conflicts: ConflictMap): Set<string> {
  const s = new Set<string>();
  for (const set of conflicts.values()) {
    for (const id of set) s.add(id);
  }
  return s;
}

/** slotKey 是否处于冲突 */
export function isSlotConflicting(conflicts: ConflictMap, week: number, day: number, period: number): boolean {
  return conflicts.has(`${week}-${day}-${period}`);
}
