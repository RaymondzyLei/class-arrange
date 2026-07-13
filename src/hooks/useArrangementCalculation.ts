import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CourseGroup } from '@/types';
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
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '排课计算失败，请稍后重试。';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function useArrangementCalculation({ scopeKey, groups, settings }: Options) {
  const [state, setState] = useState<ArrangementCalculationState>(() => (
    createArrangementCalculationState(scopeKey, groups, settings)
  ));
  const stateRef = useRef(state);
  const clientRef = useRef<ArrangementWorkerClient | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const inputKey = useMemo(
    () => calculationInputKey(groups, settings),
    [groups, settings],
  );
  const projectedState = useMemo(
    () => syncArrangementCalculationInputs(state, scopeKey, groups, settings),
    [groups, inputKey, scopeKey, settings, state],
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

  const startCalculation = useCallback(() => {
    const current = stateRef.current;
    if (!canStartArrangementCalculation(current)) return;

    const generation = ++generationRef.current;
    const calculating = startArrangementCalculation(current, generation);
    const draft = calculating.draft;
    setCurrentState(calculating);

    void getClient().calculate(draft.groups, draft.settings).then(
      (arrangements) => {
        const next = completeArrangementCalculation(
          stateRef.current,
          generation,
          arrangements,
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
    };
  }, []);

  return {
    ...projectedState,
    hasSnapshot: projectedState.committed !== null,
    actionLabel: calculationActionLabel(projectedState),
    canStart: canStartArrangementCalculation(projectedState),
    startCalculation,
  };
}
