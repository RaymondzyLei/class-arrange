import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
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

interface PlansProviderProps {
  children: ReactNode;
  semesterKey: string;
  defaultSemesterKey: string;
  validCourseIds: ReadonlySet<string>;
}

function sanitizeState(state: PlansState, validCourseIds: ReadonlySet<string>): PlansState {
  return {
    ...state,
    plans: state.plans.map((plan) => ({
      ...plan,
      courseIds: [...new Set(plan.courseIds.filter((id) => validCourseIds.has(id)))],
    })),
  };
}

function getInitialState({
  semesterKey,
  defaultSemesterKey,
  validCourseIds,
}: Omit<PlansProviderProps, 'children'>): PlansState {
  const loaded = loadPlansState(semesterKey, { defaultSemester: defaultSemesterKey });
  if (loaded && loaded.plans.length > 0) return sanitizeState(loaded, validCourseIds);
  return sanitizeState(initialPlansState(), validCourseIds);
}

export function PlansProvider({
  children,
  semesterKey,
  defaultSemesterKey,
  validCourseIds,
}: PlansProviderProps) {
  const [state, dispatch] = useReducer(
    plansReducer,
    { semesterKey, defaultSemesterKey, validCourseIds },
    getInitialState,
  );
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  // debounce 写回 localStorage
  useEffect(() => {
    const t = setTimeout(() => savePlansState(semesterKey, state), 200);
    return () => clearTimeout(t);
  }, [semesterKey, state]);

  // 学期切换会卸载 Provider；同步刷新最后一次变更，避免 200ms 窗口内丢课。
  useEffect(
    () => () => {
      savePlansState(semesterKey, latestStateRef.current);
    },
    [semesterKey],
  );

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
