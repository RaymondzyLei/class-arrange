import type { ScheduleSlot } from '@/types';
import {
  coalesceScheduleSlots,
  formatActiveWeeks,
  type DisplayScheduleSlot,
} from './scheduleDisplay';
import { formatScheduleSlotTime } from './scheduleTime';

export { formatScheduleSlotTime } from './scheduleTime';

function firstWeek(slot: DisplayScheduleSlot): number {
  return slot.activeWeeks[0] ?? 999;
}

function firstPeriod(slot: DisplayScheduleSlot): number {
  return slot.periods[0] ?? 999;
}

function compareSlots(a: DisplayScheduleSlot, b: DisplayScheduleSlot): number {
  return firstWeek(a) - firstWeek(b)
    || (a.room || '').localeCompare(b.room || '', 'zh-Hans-CN')
    || a.day - b.day
    || firstPeriod(a) - firstPeriod(b);
}

export function formatScheduleCompact(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return '时间未定';

  const grouped = new Map<string, string[]>();
  for (const slot of coalesceScheduleSlots(schedule).sort(compareSlots)) {
    const weeks = slot.weeksSpecified ? formatActiveWeeks(slot.activeWeeks) : '';
    const room = slot.room || '地点未定';
    const key = `${weeks} ${room}`;
    const value = `${slot.day}(${formatScheduleSlotTime(slot)})`;
    const existing = grouped.get(key);
    if (existing) existing.push(value);
    else grouped.set(key, [value]);
  }

  return [...grouped.entries()]
    .map(([key, values]) => `${key}: ${values.join(' ')}`)
    .join('；');
}
