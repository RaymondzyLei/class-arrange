import type { ScheduleSlot } from '@/types';
import { expandWeeks, formatWeeks } from './weeks';

function firstWeek(slot: ScheduleSlot): number {
  return expandWeeks(slot.weeks)[0] ?? 999;
}

function firstPeriod(slot: ScheduleSlot): number {
  return slot.periods[0] ?? 999;
}

function compareSlots(a: ScheduleSlot, b: ScheduleSlot): number {
  return firstWeek(a) - firstWeek(b)
    || (a.room || '').localeCompare(b.room || '', 'zh-Hans-CN')
    || a.day - b.day
    || firstPeriod(a) - firstPeriod(b);
}

export function formatScheduleCompact(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return '时间未定';

  const grouped = new Map<string, string[]>();
  for (const slot of [...schedule].sort(compareSlots)) {
    const weeks = formatWeeks(slot.weeks);
    const room = slot.room || '地点未定';
    const key = `${weeks} ${room}`;
    const value = `${slot.day}(${slot.periods.join(',')})`;
    const existing = grouped.get(key);
    if (existing) existing.push(value);
    else grouped.set(key, [value]);
  }

  return [...grouped.entries()]
    .map(([key, values]) => `${key}: ${values.join(' ')}`)
    .join('；');
}
