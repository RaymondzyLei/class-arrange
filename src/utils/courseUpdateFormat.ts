import { DAY_LABELS } from '../constants/grid';
import type { CourseFieldChange } from '../types';
import {
  coalesceScheduleSlots,
  formatActiveWeeks,
  type ScheduleDisplaySource,
} from './scheduleDisplay';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberList(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'number')) return null;
  return value;
}

function formatPeriods(periods: number[]): string {
  const sorted = [...new Set(periods)].sort((left, right) => left - right);
  if (sorted.length === 0) return '节次未定';
  const consecutive = sorted.every((period, index) => index === 0 || period === sorted[index - 1] + 1);
  if (consecutive && sorted.length > 1) return `${sorted[0]}–${sorted.at(-1)}节`;
  return `${sorted.join('、')}节`;
}

function formatSchedule(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return '时间未定';
  const slots = value.map((slot) => {
    if (!isRecord(slot)) return null;
    const weeks = numberList(slot.weeks);
    const periods = numberList(slot.periods);
    if (!weeks || typeof slot.day !== 'number' || !periods) return null;
    return {
      weeks,
      day: slot.day,
      periods,
      ...(typeof slot.startTime === 'string' ? { startTime: slot.startTime } : {}),
      ...(typeof slot.endTime === 'string' ? { endTime: slot.endTime } : {}),
    } satisfies ScheduleDisplaySource;
  });
  if (!slots.every((slot): slot is ScheduleDisplaySource => slot !== null)) return null;

  return coalesceScheduleSlots(slots).map((slot) => {
    const time = slot.startTime && slot.endTime
      ? `${slot.startTime}–${slot.endTime}`
      : formatPeriods(slot.periods);
    const weeks = slot.weeksSpecified ? formatActiveWeeks(slot.activeWeeks) : '';
    return `${weeks} ${DAY_LABELS[slot.day] ?? `周${slot.day}`} ${time}`;
  }).join('；');
}

function formatLocations(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return '地点未定';
  const locations = value.map((location) => {
    if (!isRecord(location)) return null;
    const room = typeof location.room === 'string' && location.room ? location.room : '地点未定';
    const campus = typeof location.campus === 'string' && location.campus ? `（${location.campus}）` : '';
    return `${room}${campus}`;
  });
  if (!locations.every((location): location is string => location !== null)) return null;
  return [...new Set(locations)].join('；');
}

function formatGeneric(value: unknown): string {
  if (value === undefined || value === null || value === '') return '未填写';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(formatGeneric).join('、') || '未填写';
  if (isRecord(value) && typeof value.name === 'string') return value.name || '未填写';
  return JSON.stringify(value);
}

export function formatCourseChangeSide(
  change: CourseFieldChange,
  side: 'before' | 'after',
): string | null {
  const value = change[side];
  if (value === undefined && change.field === 'details') return null;
  if (change.field === 'schedule') return formatSchedule(value) ?? formatGeneric(value);
  if (change.field === 'location') return formatLocations(value) ?? formatGeneric(value);
  return formatGeneric(value);
}
