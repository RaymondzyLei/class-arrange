import type { ResidentCampus } from '@/types';

export type CalculationMode = 'auto' | 'manual';

export const CALCULATION_MODE_OPTIONS = [
  {
    value: 'auto',
    label: '自动排课',
    description: '课程或排课偏好变化后自动重新计算。',
  },
  {
    value: 'manual',
    label: '手动开始排课',
    description: '修改后保留当前课表，按需点击开始或重新计算。',
  },
] as const satisfies ReadonlyArray<{
  value: CalculationMode;
  label: string;
  description: string;
}>;

export interface CustomScheduleSettings {
  calculationMode: CalculationMode;
  mergeAllTimeGroups: boolean;
  preferHalfDay: boolean;
  preferFewerEarlyMornings: boolean;
  preferAvoidCampusTransfers: boolean;
  residentCampus: ResidentCampus;
  blockedSlots: string[];
}

export const RESIDENT_CAMPUS_OPTIONS = [
  { value: '本部', label: '本部' },
  { value: '高新区', label: '高新' },
] as const;

export const CUSTOM_SETTINGS_KEY = 'class-arrange:v1:custom-settings';

export const DEFAULT_CUSTOM_SETTINGS: CustomScheduleSettings = {
  calculationMode: 'auto',
  mergeAllTimeGroups: false,
  preferHalfDay: false,
  preferFewerEarlyMornings: true,
  preferAvoidCampusTransfers: true,
  residentCampus: '本部',
  blockedSlots: [],
};

export function blockedSlotKey(day: number, period: number): string {
  return `${day}-${period}`;
}

function isBlockedSlot(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^([1-7])-(1[0-3]|[1-9])$/.exec(value);
  return Boolean(match);
}

export function normalizeCustomScheduleSettings(value: unknown): CustomScheduleSettings {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    calculationMode: source.calculationMode === 'manual' ? 'manual' : 'auto',
    mergeAllTimeGroups: source.mergeAllTimeGroups === true,
    preferHalfDay: typeof source.preferHalfDay === 'boolean'
      ? source.preferHalfDay
      : source.schedulePreference === 'half-day',
    preferFewerEarlyMornings: typeof source.preferFewerEarlyMornings === 'boolean'
      ? source.preferFewerEarlyMornings
      : DEFAULT_CUSTOM_SETTINGS.preferFewerEarlyMornings,
    preferAvoidCampusTransfers: typeof source.preferAvoidCampusTransfers === 'boolean'
      ? source.preferAvoidCampusTransfers
      : DEFAULT_CUSTOM_SETTINGS.preferAvoidCampusTransfers,
    residentCampus: source.residentCampus === '高新区' ? '高新区' : '本部',
    blockedSlots: Array.isArray(source.blockedSlots)
      ? [...new Set(source.blockedSlots.filter(isBlockedSlot))].sort()
      : [],
  };
}

export function parseCustomScheduleSettings(raw: string): CustomScheduleSettings {
  return normalizeCustomScheduleSettings(JSON.parse(raw));
}

export function readCustomScheduleSettings(): CustomScheduleSettings {
  try {
    const raw = localStorage.getItem(CUSTOM_SETTINGS_KEY);
    if (!raw) return DEFAULT_CUSTOM_SETTINGS;
    return parseCustomScheduleSettings(raw);
  } catch {
    return DEFAULT_CUSTOM_SETTINGS;
  }
}

export function saveCustomScheduleSettings(settings: CustomScheduleSettings): void {
  try {
    localStorage.setItem(CUSTOM_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 隐私模式或存储空间不足时保留本次会话状态
  }
}
