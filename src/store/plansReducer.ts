import type { Plan, PlansState } from '@/types';
import { genId, makePlan, nextDefaultPlanName } from '@/utils/planSeed';

export type PlansAction =
  | { type: 'init'; payload: PlansState }
  | { type: 'createPlan'; name?: string }
  | { type: 'deletePlan'; id: string }
  | { type: 'renamePlan'; id: string; name: string }
  | { type: 'switchPlan'; id: string }
  | { type: 'addCourse'; courseId: string }
  | { type: 'removeCourse'; courseId: string }
  | { type: 'clearActive' }
  | { type: 'duplicatePlan'; id: string };

function touch(plan: Plan): Plan {
  return { ...plan, updatedAt: Date.now() };
}

export function plansReducer(state: PlansState, action: PlansAction): PlansState {
  switch (action.type) {
    case 'init':
      return action.payload;

    case 'createPlan': {
      const name = action.name?.trim() || nextDefaultPlanName(state.plans);
      const plan = makePlan(name);
      return { plans: [...state.plans, plan], activePlanId: plan.id };
    }

    case 'duplicatePlan': {
      const src = state.plans.find((p) => p.id === action.id);
      if (!src) return state;
      const name = `${src.name} 副本`;
      const plan: Plan = {
        id: genId(),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        courseIds: [...src.courseIds],
      };
      return { plans: [...state.plans, plan], activePlanId: plan.id };
    }

    case 'deletePlan': {
      const remaining = state.plans.filter((p) => p.id !== action.id);
      if (remaining.length === 0) {
        return { plans: [], activePlanId: null };
      }
      let activeId = state.activePlanId;
      if (activeId === action.id) {
        activeId = remaining[0].id;
      }
      return { plans: remaining, activePlanId: activeId };
    }

    case 'renamePlan': {
      const name = action.name.trim();
      if (!name) return state;
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.id ? touch({ ...p, name }) : p,
        ),
      };
    }

    case 'switchPlan': {
      if (!state.plans.some((p) => p.id === action.id)) return state;
      return { ...state, activePlanId: action.id };
    }

    case 'addCourse': {
      if (!state.activePlanId) return state;
      return {
        ...state,
        plans: state.plans.map((p) => {
          if (p.id !== state.activePlanId) return p;
          if (p.courseIds.includes(action.courseId)) return p;
          return touch({ ...p, courseIds: [...p.courseIds, action.courseId] });
        }),
      };
    }

    case 'removeCourse': {
      if (!state.activePlanId) return state;
      return {
        ...state,
        plans: state.plans.map((p) => {
          if (p.id !== state.activePlanId) return p;
          if (!p.courseIds.includes(action.courseId)) return p;
          return touch({
            ...p,
            courseIds: p.courseIds.filter((id) => id !== action.courseId),
          });
        }),
      };
    }

    case 'clearActive': {
      if (!state.activePlanId) return state;
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === state.activePlanId ? touch({ ...p, courseIds: [] }) : p,
        ),
      };
    }

    default:
      return state;
  }
}
