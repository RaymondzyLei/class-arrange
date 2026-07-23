import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlansState } from '@/types';
import { plansReducer } from './plansReducer';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('plansReducer importPlan', () => {
  it('reuses the only empty plan and preserves its identity', () => {
    const state: PlansState = {
      plans: [{
        id: 'p1',
        name: '曾经改过名',
        createdAt: 1,
        updatedAt: 1,
        courseIds: [],
      }],
      activePlanId: 'p1',
    };
    vi.spyOn(Date, 'now').mockReturnValue(10);

    const next = plansReducer(state, {
      type: 'importPlan',
      name: '同学的方案',
      courseIds: ['A.01', 'A.01', 'B.01'],
    });

    expect(next).toEqual({
      plans: [{
        id: 'p1',
        name: '同学的方案',
        createdAt: 1,
        updatedAt: 10,
        courseIds: ['A.01', 'B.01'],
      }],
      activePlanId: 'p1',
    });
  });

  it('creates and activates a plan without overwriting existing plans', () => {
    const state: PlansState = {
      plans: [{
        id: 'p1',
        name: '方案一',
        createdAt: 1,
        updatedAt: 1,
        courseIds: ['A.01'],
      }],
      activePlanId: 'p1',
    };
    vi.spyOn(Date, 'now').mockReturnValue(20);

    const next = plansReducer(state, {
      type: 'importPlan',
      name: '同学的方案',
      courseIds: ['B.01'],
    });

    expect(next.plans[0]).toEqual(state.plans[0]);
    expect(next.plans[1]).toMatchObject({
      name: '同学的方案',
      createdAt: 20,
      updatedAt: 20,
      courseIds: ['B.01'],
    });
    expect(next.plans[1].id).not.toBe('p1');
    expect(next.activePlanId).toBe(next.plans[1].id);
  });

  it('defensively refuses an eleventh plan', () => {
    const plans = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      name: `P${index}`,
      createdAt: 1,
      updatedAt: 1,
      courseIds: ['A.01'],
    }));
    const state: PlansState = { plans, activePlanId: '0' };

    expect(plansReducer(state, {
      type: 'importPlan',
      name: '额外方案',
      courseIds: ['B.01'],
    })).toBe(state);
  });

  it('ignores imports without valid courses', () => {
    const state: PlansState = {
      plans: [{
        id: 'p1',
        name: '方案一',
        createdAt: 1,
        updatedAt: 1,
        courseIds: [],
      }],
      activePlanId: 'p1',
    };

    expect(plansReducer(state, {
      type: 'importPlan',
      name: '空方案',
      courseIds: [],
    })).toBe(state);
  });
});
