import { PERIOD_TIMES } from '../constants/grid';
import type { ScheduleSlot } from '@/types';

export interface MinuteInterval {
  start: number;
  end: number;
}

type ScheduleTimeSource = Pick<ScheduleSlot, 'periods' | 'startTime' | 'endTime'>;
type ScheduleDayTimeSource = ScheduleTimeSource & Pick<ScheduleSlot, 'day'>;

const CLOCK_PATTERN = /^(\d{1,2}):(\d{2})$/;

export function parseClockMinutes(value: string | undefined): number | null {
  const match = value?.trim().match(CLOCK_PATTERN);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatClockMinutes(value: number): string {
  const hours = Math.floor(value / 60).toString().padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function exactScheduleInterval(slot: ScheduleTimeSource): MinuteInterval | null {
  const start = parseClockMinutes(slot.startTime);
  const end = parseClockMinutes(slot.endTime);
  if (start === null || end === null || start >= end) return null;
  return { start, end };
}

export function periodMinuteInterval(period: number): MinuteInterval | null {
  const time = PERIOD_TIMES[period];
  if (!time) return null;
  const start = parseClockMinutes(time.start);
  const end = parseClockMinutes(time.end);
  if (start === null || end === null) return null;
  return { start, end };
}

/**
 * 精确钟点优先；只有未提供合法起止时间时才回退到标准节次。
 * 标准节次分别保留为半开区间，课间休息不会被误判为占用。
 */
export function scheduleSlotMinuteIntervals(slot: ScheduleTimeSource): MinuteInterval[] {
  const exact = exactScheduleInterval(slot);
  if (exact) return [exact];

  const intervals: MinuteInterval[] = [];
  const seen = new Set<number>();
  for (const period of slot.periods) {
    if (seen.has(period)) continue;
    seen.add(period);
    const interval = periodMinuteInterval(period);
    if (interval) intervals.push(interval);
  }
  return intervals.sort((left, right) => left.start - right.start || left.end - right.end);
}

export function minuteIntervalsOverlap(
  left: MinuteInterval,
  right: MinuteInterval,
): boolean {
  return left.start < right.end && right.start < left.end;
}

export function formatScheduleSlotTime(slot: ScheduleTimeSource): string {
  const exact = exactScheduleInterval(slot);
  if (exact) {
    return `${formatClockMinutes(exact.start)}~${formatClockMinutes(exact.end)}`;
  }
  return slot.periods.join(',');
}

export function hasExactScheduleTime(slot: ScheduleTimeSource): boolean {
  return exactScheduleInterval(slot) !== null;
}

export function blockedMinuteIntervalsByDay(
  blockedSlots: Iterable<string>,
): Map<number, MinuteInterval[]> {
  const byDay = new Map<number, MinuteInterval[]>();
  for (const key of blockedSlots) {
    const match = /^(\d+)-(\d+)$/.exec(key);
    if (!match) continue;
    const day = Number(match[1]);
    const interval = periodMinuteInterval(Number(match[2]));
    if (day < 1 || day > 7 || !interval) continue;
    const intervals = byDay.get(day);
    if (intervals) intervals.push(interval);
    else byDay.set(day, [interval]);
  }
  return byDay;
}

export function scheduleSlotOverlapsBlocked(
  slot: ScheduleDayTimeSource,
  blockedByDay: ReadonlyMap<number, MinuteInterval[]>,
): boolean {
  const blocked = blockedByDay.get(slot.day);
  if (!blocked?.length) return false;
  return scheduleSlotMinuteIntervals(slot).some((interval) =>
    blocked.some((blockedInterval) => minuteIntervalsOverlap(interval, blockedInterval)));
}
