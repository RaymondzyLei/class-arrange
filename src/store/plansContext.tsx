import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Plan, PlansState } from '@/types';
import { plansReducer, type PlansAction } from './plansReducer';
import {
  initialPlansState,
  loadPlansState,
  savePlansState,
} from '@/utils/planSeed';

interface PlansContextValue {
  state: PlansState;
  activePlan: Plan | null;
  dispatch: React.Dispatch<PlansAction>;
}

const PlansContext = createContext<PlansContextValue | null>(null);

function getInitialState(): PlansState {
  if (typeof window === 'undefined') return initialPlansState();
  const loaded = loadPlansState();
  if (loaded && loaded.plans.length > 0) return loaded;
  return initialPlansState();
}

export function PlansProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(plansReducer, undefined, getInitialState);

  // debounce 写回 localStorage
  useEffect(() => {
    const t = setTimeout(() => savePlansState(state), 200);
    return () => clearTimeout(t);
  }, [state]);

  const activePlan = state.plans.find((p) => p.id === state.activePlanId) ?? null;

  return (
    <PlansContext.Provider value={{ state, activePlan, dispatch }}>
      {children}
    </PlansContext.Provider>
  );
}

export function usePlans(): PlansContextValue {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within PlansProvider');
  return ctx;
}
