import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Arrangement,
  ArrangementFavoritePreferences,
  CourseGroup,
} from '@/types';
import {
  calculationActionLabel,
  calculationInputKey,
  canStartArrangementCalculation,
  completeArrangementCalculation,
  createArrangementCalculationState,
  failArrangementCalculation,
  recoverCancelledArrangementCalculation,
  shouldSynchronizeArrangementCalculationProjection,
  shouldAutomaticallyCalculate,
  startArrangementCalculation,
  syncArrangementCalculationInputs,
  type ArrangementCalculationState,
} from '@/utils/arrangementCalculationState';
import {
  createArrangementWorkerClient,
  type ArrangementWorkerClient,
} from '@/utils/arrangementWorkerClient';
import type { CustomScheduleSettings } from '@/utils/customization';

interface Options {
  scopeKey: string;
  groups: CourseGroup[];
  settings: CustomScheduleSettings;
  favorites?: ArrangementFavoritePreferences;
}

type AllConflictFreePhase = 'idle' | 'loading' | 'ready' | 'error';

interface AllConflictFreeState {
  phase: AllConflictFreePhase;
  inputKey: string | null;
  arrangements: Arrangement[];
  error: string | null;
}

const EMPTY_ALL_CONFLICT_FREE: AllConflictFreeState = {
  phase: 'idle',
  inputKey: null,
  arrangements: [],
  error: null,
};

const EMPTY_FAVORITES: ArrangementFavoritePreferences = {
  arrangementIds: [],
  timeGroupKeys: [],
  sectionIds: [],
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '排课计算失败，请稍后重试。';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function useArrangementCalculation({
  scopeKey,
  groups,
  settings,
  favorites = EMPTY_FAVORITES,
}: Options) {
  const [state, setState] = useState<ArrangementCalculationState>(() => (
    createArrangementCalculationState(scopeKey, groups, settings, favorites)
  ));
  const stateRef = useRef(state);
  const clientRef = useRef<ArrangementWorkerClient | null>(null);
  const allConflictFreeClientRef = useRef<ArrangementWorkerClient | null>(null);
  const [allConflictFree, setAllConflictFree] = useState<AllConflictFreeState>(
    EMPTY_ALL_CONFLICT_FREE,
  );
  const allConflictFreeRef = useRef(allConflictFree);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const inputKey = useMemo(
    () => calculationInputKey(groups, settings, favorites),
    [favorites, groups, settings],
  );
  const projectedState = useMemo(
    () => syncArrangementCalculationInputs(state, scopeKey, groups, settings, favorites),
    [favorites, groups, inputKey, scopeKey, settings, state],
  );

  // Project draft changes during render so a plan/semester hard reset cannot paint
  // the previous scope's committed timetable for one frame.
  stateRef.current = projectedState;

  const setCurrentState = useCallback((next: ArrangementCalculationState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createArrangementWorkerClient();
    return clientRef.current;
  }, []);

  const setCurrentAllConflictFree = useCallback((next: AllConflictFreeState) => {
    allConflictFreeRef.current = next;
    setAllConflictFree(next);
  }, []);

  const getAllConflictFreeClient = useCallback(() => {
    if (!allConflictFreeClientRef.current) {
      allConflictFreeClientRef.current = createArrangementWorkerClient();
    }
    return allConflictFreeClientRef.current;
  }, []);

  const startCalculation = useCallback(() => {
    const current = stateRef.current;
    if (!canStartArrangementCalculation(current)) return;

    const generation = ++generationRef.current;
    const calculating = startArrangementCalculation(current, generation);
    const draft = calculating.draft;
    setCurrentState(calculating);

    void getClient().calculateResults(
      draft.groups,
      draft.settings,
      'recommended',
      draft.favorites,
    ).then(
      (result) => {
        const next = completeArrangementCalculation(
          stateRef.current,
          generation,
          result,
        );
        if (next !== stateRef.current) setCurrentState(next);
      },
      (error: unknown) => {
        if (isAbortError(error)) {
          if (!mountedRef.current) return;
          const next = recoverCancelledArrangementCalculation(
            stateRef.current,
            generation,
          );
          if (next !== stateRef.current) setCurrentState(next);
          return;
        }
        const next = failArrangementCalculation(
          stateRef.current,
          generation,
          errorMessage(error),
        );
        if (next !== stateRef.current) setCurrentState(next);
      },
    );
  }, [getClient, setCurrentState]);

  const loadAllConflictFree = useCallback(() => {
    const committed = stateRef.current.committed;
    if (!committed || allConflictFreeRef.current.phase === 'loading') return;
    const requestInputKey = committed.inputKey;
    setCurrentAllConflictFree({
      phase: 'loading',
      inputKey: requestInputKey,
      arrangements: allConflictFreeRef.current.inputKey === requestInputKey
        ? allConflictFreeRef.current.arrangements
        : [],
      error: null,
    });

    void getAllConflictFreeClient().calculateResults(
      committed.groups,
      committed.settings,
      'all-conflict-free',
      committed.favorites,
    ).then(
      (result) => {
        if (!mountedRef.current || stateRef.current.committed?.inputKey !== requestInputKey) return;
        setCurrentAllConflictFree({
          phase: 'ready',
          inputKey: requestInputKey,
          arrangements: result.arrangements,
          error: null,
        });
      },
      (error: unknown) => {
        if (isAbortError(error) || !mountedRef.current) return;
        if (stateRef.current.committed?.inputKey !== requestInputKey) return;
        setCurrentAllConflictFree({
          phase: 'error',
          inputKey: requestInputKey,
          arrangements: allConflictFreeRef.current.inputKey === requestInputKey
            ? allConflictFreeRef.current.arrangements
            : [],
          error: errorMessage(error),
        });
      },
    );
  }, [getAllConflictFreeClient, setCurrentAllConflictFree]);

  useEffect(() => {
    const inputsChanged = state.draft.scopeKey !== scopeKey
      || state.draft.inputKey !== inputKey;
    if (inputsChanged && state.activeGeneration !== null) {
      clientRef.current?.cancel();
    }
    if (shouldSynchronizeArrangementCalculationProjection(
      state,
      projectedState,
      stateRef.current,
    )) {
      setCurrentState(projectedState);
    }
  }, [inputKey, projectedState, scopeKey, setCurrentState, state]);

  useEffect(() => {
    allConflictFreeClientRef.current?.cancel();
    setCurrentAllConflictFree(EMPTY_ALL_CONFLICT_FREE);
  }, [inputKey, scopeKey, setCurrentAllConflictFree]);

  useEffect(() => {
    if (
      shouldAutomaticallyCalculate(projectedState)
      && shouldAutomaticallyCalculate(stateRef.current)
    ) {
      startCalculation();
    }
  }, [projectedState, startCalculation]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clientRef.current?.dispose();
      clientRef.current = null;
      allConflictFreeClientRef.current?.dispose();
      allConflictFreeClientRef.current = null;
    };
  }, []);

  return {
    ...projectedState,
    hasSnapshot: projectedState.committed !== null,
    actionLabel: calculationActionLabel(projectedState),
    canStart: canStartArrangementCalculation(projectedState),
    startCalculation,
    allConflictFreePhase: allConflictFree.phase,
    allConflictFreeArrangements: allConflictFree.arrangements,
    allConflictFreeError: allConflictFree.error,
    loadAllConflictFree,
  };
}
