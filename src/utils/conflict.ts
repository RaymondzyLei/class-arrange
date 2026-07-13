import type { CourseGroup } from '@/types';
import { expandWeeks } from './weeks';
import {
  blockedMinuteIntervalsByDay,
  minuteIntervalsOverlap,
  periodMinuteInterval,
  scheduleSlotMinuteIntervals,
  scheduleSlotOverlapsBlocked,
} from './scheduleTime';

/** 键为 `${week}-${day}@${overlapStart}-${overlapEnd}`（分钟）。 */
export type ConflictMap = Map<string, Set<string>>;

interface OccupiedInterval {
  groupKey: string;
  start: number;
  end: number;
}

/**
 * 检测一组选课单元之间的时间冲突。
 * 冲突定义：存在某周、某天的真实分钟区间被两门及以上
 * **不同选课单元**同时占用。区间按 [start, end) 处理，端点相接不冲突。
 *
 * 按 group.key 占用 slotKey：同一选课单元内（同课程号同时间的多个班次）
 * 占同一格不算冲突，消除"同课同时间不同老师"的误报。
 */
export function detectConflicts(groups: CourseGroup[]): ConflictMap {
  const occupiedByWeekDay = new Map<string, OccupiedInterval[]>();
  for (const g of groups) {
    for (const slot of g.schedule) {
      const intervals = scheduleSlotMinuteIntervals(slot);
      for (const w of expandWeeks(slot.weeks)) {
        const key = `${w}-${slot.day}`;
        let occupied = occupiedByWeekDay.get(key);
        if (!occupied) {
          occupied = [];
          occupiedByWeekDay.set(key, occupied);
        }
        for (const interval of intervals) {
          occupied.push({ groupKey: g.key, ...interval });
        }
      }
    }
  }

  const conflicts: ConflictMap = new Map();
  for (const [weekDay, occupied] of occupiedByWeekDay) {
    occupied.sort((left, right) => left.start - right.start || left.end - right.end);
    for (let leftIndex = 0; leftIndex < occupied.length; leftIndex += 1) {
      const left = occupied[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < occupied.length; rightIndex += 1) {
        const right = occupied[rightIndex];
        if (right.start >= left.end) break;
        if (left.groupKey === right.groupKey || !minuteIntervalsOverlap(left, right)) continue;
        const overlapStart = Math.max(left.start, right.start);
        const overlapEnd = Math.min(left.end, right.end);
        const key = `${weekDay}@${overlapStart}-${overlapEnd}`;
        const groupKeys = conflicts.get(key);
        if (groupKeys) {
          groupKeys.add(left.groupKey);
          groupKeys.add(right.groupKey);
        } else {
          conflicts.set(key, new Set([left.groupKey, right.groupKey]));
        }
      }
    }
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
  const blockedByDay = blockedMinuteIntervalsByDay(blockedSlots);
  const conflictGroups = new Set<string>();
  if (blockedByDay.size === 0) return conflictGroups;
  for (const group of groups) {
    if (group.schedule.some((slot) => scheduleSlotOverlapsBlocked(slot, blockedByDay))) {
      conflictGroups.add(group.key);
    }
  }
  return conflictGroups;
}

/** slotKey 是否处于冲突 */
export function isSlotConflicting(conflicts: ConflictMap, week: number, day: number, period: number): boolean {
  const periodInterval = periodMinuteInterval(period);
  if (!periodInterval) return false;
  const prefix = `${week}-${day}@`;
  for (const key of conflicts.keys()) {
    if (!key.startsWith(prefix)) continue;
    const match = /@(\d+)-(\d+)$/.exec(key);
    if (!match) continue;
    if (minuteIntervalsOverlap(periodInterval, {
      start: Number(match[1]),
      end: Number(match[2]),
    })) return true;
  }
  return false;
}
