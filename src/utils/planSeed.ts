import type { PlansState } from '@/types';

export const STORAGE_KEY = 'class-arrange:v1:plans';
export const STORAGE_VERSION = 1;

interface StoredPayload {
  version: number;
  state: PlansState;
}

export function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_PLAN_NAMES = ['方案一', '方案二', '方案三'];

export function makePlan(name: string) {
  const now = Date.now();
  return { id: genId(), name, createdAt: now, updatedAt: now, courseIds: [] };
}

/** 初始空状态：带一个默认方案 */
export function initialPlansState(): PlansState {
  const plan = makePlan(DEFAULT_PLAN_NAMES[0]);
  return { plans: [plan], activePlanId: plan.id };
}

/** 读取并校验 localStorage 中的方案数据，失败返回 null */
export function loadPlansState(): PlansState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
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

export function savePlansState(state: PlansState): boolean {
  try {
    const payload: StoredPayload = { version: STORAGE_VERSION, state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function nextDefaultPlanName(existing: { name: string }[]): string {
  for (const n of DEFAULT_PLAN_NAMES) {
    if (!existing.some((p) => p.name === n)) return n;
  }
  return `方案${existing.length + 1}`;
}
