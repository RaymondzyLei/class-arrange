export interface CustomScheduleSettings {
  preferHalfDay: boolean;
  preferFewerEarlyMornings: boolean;
  blockedSlots: string[];
}

export const CUSTOM_SETTINGS_KEY = 'class-arrange:v1:custom-settings';

export const DEFAULT_CUSTOM_SETTINGS: CustomScheduleSettings = {
  preferHalfDay: false,
  preferFewerEarlyMornings: true,
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

export function readCustomScheduleSettings(): CustomScheduleSettings {
  try {
    const raw = localStorage.getItem(CUSTOM_SETTINGS_KEY);
    if (!raw) return DEFAULT_CUSTOM_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CustomScheduleSettings> & {
      schedulePreference?: unknown;
    };
    return {
      preferHalfDay: typeof parsed.preferHalfDay === 'boolean'
        ? parsed.preferHalfDay
        : parsed.schedulePreference === 'half-day',
      preferFewerEarlyMornings: typeof parsed.preferFewerEarlyMornings === 'boolean'
        ? parsed.preferFewerEarlyMornings
        : DEFAULT_CUSTOM_SETTINGS.preferFewerEarlyMornings,
      blockedSlots: Array.isArray(parsed.blockedSlots)
        ? [...new Set(parsed.blockedSlots.filter(isBlockedSlot))].sort()
        : [],
    };
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
