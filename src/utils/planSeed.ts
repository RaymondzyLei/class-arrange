import type { PlansState } from '@/types';

export const LEGACY_STORAGE_KEY = 'class-arrange:v1:plans';
export const PLANS_MIGRATED_KEY = 'class-arrange:v2:plans-migrated';
export const STORAGE_VERSION = 1;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredPayload {
  version: number;
  state: PlansState;
}

export function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_PLAN_NAMES = ['方案一', '方案二', '方案三'];
const CHINESE_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseNumber(value: number): string {
  if (value <= 0) return String(value);
  if (value < 10) return CHINESE_DIGITS[value];
  if (value === 10) return '十';
  if (value < 20) return `十${CHINESE_DIGITS[value - 10]}`;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${CHINESE_DIGITS[tens]}十${ones === 0 ? '' : CHINESE_DIGITS[ones]}`;
  }
  return String(value);
}

export function makePlan(name: string) {
  const now = Date.now();
  return { id: genId(), name, createdAt: now, updatedAt: now, courseIds: [] };
}

/** 初始空状态：带一个默认方案 */
export function initialPlansState(): PlansState {
  const plan = makePlan(DEFAULT_PLAN_NAMES[0]);
  return { plans: [plan], activePlanId: plan.id };
}

export function plansStorageKey(semesterKey: string): string {
  return `class-arrange:v2:plans:${semesterKey}`;
}

function parsePlansState(raw: string | null): PlansState | null {
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as StoredPayload;
    if (!payload || typeof payload !== 'object') return null;
    if (payload.version !== STORAGE_VERSION) return null;
    const s = payload.state;
    if (!s || !Array.isArray(s.plans)) return null;
    if (s.plans.length === 0) return { plans: [], activePlanId: null };
    if (s.activePlanId && !s.plans.some((p) => p.id === s.activePlanId)) {
      s.activePlanId = s.plans[0].id;
    }
    if (!s.activePlanId) s.activePlanId = s.plans[0].id;
    return s;
  } catch {
    return null;
  }
}

function browserStorage(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/** 读取当前学期方案；旧 v1 数据仅迁移一次且只进入默认学期。 */
export function loadPlansState(
  semesterKey: string,
  options: { defaultSemester: string; storage?: StorageLike },
): PlansState | null {
  const storage = options.storage ?? browserStorage();
  if (!storage) return null;
  try {
    const current = parsePlansState(storage.getItem(plansStorageKey(semesterKey)));
    if (current) return current;
    if (
      semesterKey !== options.defaultSemester ||
      storage.getItem(PLANS_MIGRATED_KEY) === '1'
    ) {
      return null;
    }
    const legacy = parsePlansState(storage.getItem(LEGACY_STORAGE_KEY));
    if (legacy) savePlansState(semesterKey, legacy, storage);
    storage.setItem(PLANS_MIGRATED_KEY, '1');
    return legacy;
  } catch {
    return null;
  }
}

export function savePlansState(
  semesterKey: string,
  state: PlansState,
  suppliedStorage?: StorageLike,
): boolean {
  const storage = suppliedStorage ?? browserStorage();
  if (!storage) return false;
  try {
    const payload: StoredPayload = { version: STORAGE_VERSION, state };
    storage.setItem(plansStorageKey(semesterKey), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function nextDefaultPlanName(existing: { name: string }[]): string {
  for (const n of DEFAULT_PLAN_NAMES) {
    if (!existing.some((p) => p.name === n)) return n;
  }
  for (let i = 4; i <= existing.length + 1; i += 1) {
    const name = `方案${toChineseNumber(i)}`;
    if (!existing.some((p) => p.name === name)) return name;
  }
  return `方案${toChineseNumber(existing.length + 1)}`;
}

export function nextDuplicatePlanName(sourceName: string, existing: { name: string }[]): string {
  const baseName = sourceName.replace(/ 副本(?: \d+)?$/, '');
  const firstCopyName = `${baseName} 副本`;
  const names = new Set(existing.map((p) => p.name));
  if (!names.has(firstCopyName)) return firstCopyName;
  let index = 2;
  while (names.has(`${firstCopyName} ${index}`)) index += 1;
  return `${firstCopyName} ${index}`;
}
