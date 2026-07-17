import type { Arrangement, CourseGroup } from '@/types';
import type { CustomScheduleSettings } from './customization';
import type { ArrangementEnumerationResult } from './arrangementEngine';

export type ArrangementCalculationPhase =
  | 'empty'
  | 'dirty'
  | 'calculating'
  | 'ready'
  | 'error';

export interface ArrangementCalculationDraft {
  scopeKey: string;
  inputKey: string;
  groups: CourseGroup[];
  settings: CustomScheduleSettings;
}

export interface CommittedArrangementCalculation extends ArrangementCalculationDraft {
  arrangements: Arrangement[];
  conflictFreePreview: Arrangement[];
  totalConflictFreeCount: number;
}

export interface ArrangementCalculationState {
  phase: ArrangementCalculationPhase;
  draft: ArrangementCalculationDraft;
  committed: CommittedArrangementCalculation | null;
  activeGeneration: number | null;
  error: string | null;
}

function copySettings(settings: CustomScheduleSettings): CustomScheduleSettings {
  return {
    ...settings,
    blockedSlots: [...settings.blockedSlots],
  };
}

function createDraft(
  scopeKey: string,
  groups: CourseGroup[],
  settings: CustomScheduleSettings,
): ArrangementCalculationDraft {
  return {
    scopeKey,
    inputKey: calculationInputKey(groups, settings),
    groups: [...groups],
    settings: copySettings(settings),
  };
}

export function calculationInputKey(
  groups: CourseGroup[],
  settings: CustomScheduleSettings,
): string {
  return JSON.stringify({
    groups: groups.map((group) => [group.courseCode, group.key, group.sectionIds]),
    arrangementDisplayCount: settings.arrangementDisplayCount,
    preferHalfDay: settings.preferHalfDay,
    preferFewerEarlyMornings: settings.preferFewerEarlyMornings,
    preferAvoidCampusTransfers: settings.preferAvoidCampusTransfers,
    residentCampus: settings.residentCampus,
    blockedSlots: [...settings.blockedSlots].sort(),
  });
}

export function createArrangementCalculationState(
  scopeKey: string,
  groups: CourseGroup[],
  settings: CustomScheduleSettings,
): ArrangementCalculationState {
  return {
    phase: groups.length === 0 ? 'empty' : 'dirty',
    draft: createDraft(scopeKey, groups, settings),
    committed: null,
    activeGeneration: null,
    error: null,
  };
}

export function syncArrangementCalculationInputs(
  state: ArrangementCalculationState,
  scopeKey: string,
  groups: CourseGroup[],
  settings: CustomScheduleSettings,
): ArrangementCalculationState {
  const draft = createDraft(scopeKey, groups, settings);
  if (scopeKey !== state.draft.scopeKey) {
    return {
      phase: groups.length === 0 ? 'empty' : 'dirty',
      draft,
      committed: null,
      activeGeneration: null,
      error: null,
    };
  }
  if (draft.inputKey === state.draft.inputKey) {
    if (draft.settings.calculationMode === state.draft.settings.calculationMode) {
      return state;
    }
    return {
      ...state,
      draft,
    };
  }
  return {
    ...state,
    phase: groups.length === 0 && state.committed === null ? 'empty' : 'dirty',
    draft,
    activeGeneration: null,
    error: null,
  };
}

export function shouldSynchronizeArrangementCalculationProjection(
  renderedState: ArrangementCalculationState,
  projectedState: ArrangementCalculationState,
  latestState: ArrangementCalculationState,
): boolean {
  return projectedState !== renderedState && latestState === projectedState;
}

export function canStartArrangementCalculation(state: ArrangementCalculationState): boolean {
  return state.phase === 'dirty' || state.phase === 'error';
}

export function shouldAutomaticallyCalculate(state: ArrangementCalculationState): boolean {
  return state.phase === 'dirty' && state.draft.settings.calculationMode === 'auto';
}

export function calculationActionLabel(
  state: ArrangementCalculationState,
): '开始排课' | '重新计算' {
  return state.committed === null ? '开始排课' : '重新计算';
}

export function startArrangementCalculation(
  state: ArrangementCalculationState,
  generation: number,
): ArrangementCalculationState {
  if (!canStartArrangementCalculation(state)) return state;
  return {
    ...state,
    phase: 'calculating',
    activeGeneration: generation,
    error: null,
  };
}

export function completeArrangementCalculation(
  state: ArrangementCalculationState,
  generation: number,
  value: Arrangement[] | ArrangementEnumerationResult,
): ArrangementCalculationState {
  if (state.activeGeneration !== generation) return state;
  const result = Array.isArray(value)
    ? {
        arrangements: value,
        conflictFreePreview: value.filter(({ conflictCount }) => conflictCount === 0).slice(0, 100),
        totalConflictFreeCount: value.filter(({ conflictCount }) => conflictCount === 0).length,
      }
    : value;
  return {
    ...state,
    phase: 'ready',
    committed: {
      ...state.draft,
      groups: [...state.draft.groups],
      settings: copySettings(state.draft.settings),
      arrangements: result.arrangements,
      conflictFreePreview: result.conflictFreePreview,
      totalConflictFreeCount: result.totalConflictFreeCount,
    },
    activeGeneration: null,
    error: null,
  };
}

export function failArrangementCalculation(
  state: ArrangementCalculationState,
  generation: number,
  error: string,
): ArrangementCalculationState {
  if (state.activeGeneration !== generation) return state;
  return {
    ...state,
    phase: 'error',
    activeGeneration: null,
    error,
  };
}

export function recoverCancelledArrangementCalculation(
  state: ArrangementCalculationState,
  generation: number,
): ArrangementCalculationState {
  if (state.activeGeneration !== generation) return state;
  return {
    ...state,
    phase: state.draft.groups.length === 0 && state.committed === null ? 'empty' : 'dirty',
    activeGeneration: null,
    error: null,
  };
}

export function resolveSelectedArrangementId(
  _selectedId: string | null,
  arrangements: Arrangement[],
): string | null {
  // A committed result list has already been ranked with the latest preferences.
  // Always apply its new best result instead of following the previous timetable
  // to a different visible index (for example, #0 becoming #2).
  return arrangements[0]?.id ?? null;
}
