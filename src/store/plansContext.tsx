import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import type { CourseSection, Plan, PlansState } from '@/types';
import { plansReducer, type PlansAction } from './plansReducer';
import {
  initialPlansState,
  loadPlansPayload,
  savePlansPayload,
  type StoredPlansPayloadV2,
} from '@/utils/planSeed';
import { reconcilePlansWithCatalog } from '@/updates/planReconciliation';

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
  courseMap: ReadonlyMap<string, CourseSection>;
  catalogRevision: string;
}

function freshPayload(state: PlansState): StoredPlansPayloadV2 {
  return {
    version: 2,
    state,
    selectedSnapshots: {},
    impactHistory: [],
    pendingImpacts: [],
    catalogRevision: null,
  };
}

function getInitialState({
  semesterKey,
  defaultSemesterKey,
  courseMap,
  catalogRevision,
}: Omit<PlansProviderProps, 'children'>): PlansState {
  const loaded = loadPlansPayload(semesterKey, { defaultSemester: defaultSemesterKey });
  const payload = loaded && loaded.state.plans.length > 0
    ? loaded
    : freshPayload(initialPlansState());
  const reconciled = reconcilePlansWithCatalog(
    payload,
    semesterKey,
    catalogRevision,
    courseMap,
  );
  savePlansPayload(semesterKey, reconciled);
  return reconciled.state;
}

export function PlansProvider({
  children,
  semesterKey,
  defaultSemesterKey,
  courseMap,
  catalogRevision,
}: PlansProviderProps) {
  const [state, dispatch] = useReducer(
    plansReducer,
    { semesterKey, defaultSemesterKey, courseMap, catalogRevision },
    getInitialState,
  );
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  // debounce 写回 localStorage
  useEffect(() => {
    const t = setTimeout(() => {
      const stored = loadPlansPayload(semesterKey, { defaultSemester: defaultSemesterKey });
      const payload = stored ? { ...stored, state } : freshPayload(state);
      savePlansPayload(
        semesterKey,
        reconcilePlansWithCatalog(payload, semesterKey, catalogRevision, courseMap),
      );
    }, 200);
    return () => clearTimeout(t);
  }, [catalogRevision, courseMap, defaultSemesterKey, semesterKey, state]);

  // 学期切换会卸载 Provider；同步刷新最后一次变更，避免 200ms 窗口内丢课。
  useEffect(
    () => () => {
      const stored = loadPlansPayload(semesterKey, { defaultSemester: defaultSemesterKey });
      const state = latestStateRef.current;
      const payload = stored ? { ...stored, state } : freshPayload(state);
      savePlansPayload(
        semesterKey,
        reconcilePlansWithCatalog(payload, semesterKey, catalogRevision, courseMap),
      );
    },
    [catalogRevision, courseMap, defaultSemesterKey, semesterKey],
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
