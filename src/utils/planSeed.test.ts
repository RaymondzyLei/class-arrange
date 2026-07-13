import { describe, expect, test } from 'vitest';
import type { PlansState } from '@/types';
import {
  LEGACY_STORAGE_KEY,
  loadPlansState,
  plansStorageKey,
  savePlansState,
} from './planSeed';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const state: PlansState = {
  plans: [{ id: 'p1', name: '方案一', createdAt: 1, updatedAt: 1, courseIds: ['A.01'] }],
  activePlanId: 'p1',
};

describe('semester-scoped plans', () => {
  test('builds a distinct storage key for each semester', () => {
    expect(plansStorageKey('2026-fall')).toBe('class-arrange:v2:plans:2026-fall');
    expect(plansStorageKey('2026-summer')).toBe('class-arrange:v2:plans:2026-summer');
  });

  test('saves and loads semesters independently', () => {
    const storage = new MemoryStorage();
    savePlansState('2026-fall', state, storage);
    expect(loadPlansState('2026-fall', { defaultSemester: '2026-fall', storage })).toEqual(state);
    expect(loadPlansState('2026-summer', { defaultSemester: '2026-fall', storage })).toBeNull();
  });

  test('migrates the legacy payload only into the default semester', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ version: 1, state }));
    expect(loadPlansState('2026-summer', { defaultSemester: '2026-fall', storage })).toBeNull();
    expect(loadPlansState('2026-fall', { defaultSemester: '2026-fall', storage })).toEqual(state);
    expect(loadPlansState('2026-summer', { defaultSemester: '2026-fall', storage })).toBeNull();
  });
});
