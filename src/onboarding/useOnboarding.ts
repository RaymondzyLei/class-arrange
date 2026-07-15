import { useCallback, useState } from 'react';
import type { ResidentCampus } from '@/types';
import type { CalculationMode } from '@/utils/customization';

const ONBOARDING_STORAGE_KEY = 'class-arrange:v1:onboarding';
const LEGACY_COMPLETED_KEY = 'onboardingCompleted';

export interface OnboardingPreferences {
  calculationMode: CalculationMode;
  preferHalfDay: boolean;
  preferFewerEarlyMornings: boolean;
  preferAvoidCampusTransfers: boolean;
  residentCampus: ResidentCampus;
  showUpdatePopup: boolean;
}

export interface OnboardingState {
  wizardCompleted: boolean;
  tourCompleted: boolean;
  skipped: boolean;
  preferences: OnboardingPreferences;
}

export type OnboardingStage = 'hidden' | 'wizard' | 'tour';
export type OnboardingTourEntryMode = 'wizard' | 'manual';

export const DEFAULT_ONBOARDING_PREFERENCES: OnboardingPreferences = {
  calculationMode: 'auto',
  preferHalfDay: false,
  preferFewerEarlyMornings: true,
  preferAvoidCampusTransfers: true,
  residentCampus: '本部',
  showUpdatePopup: true,
};

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  wizardCompleted: false,
  tourCompleted: false,
  skipped: false,
  preferences: DEFAULT_ONBOARDING_PREFERENCES,
};

function booleanFrom(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePreferences(value: unknown): OnboardingPreferences {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  return {
    calculationMode: source.calculationMode === 'manual' ? 'manual' : 'auto',
    preferHalfDay: booleanFrom(
      source.preferHalfDay ?? source.preferCompactSchedule,
      DEFAULT_ONBOARDING_PREFERENCES.preferHalfDay,
    ),
    preferFewerEarlyMornings: booleanFrom(
      source.preferFewerEarlyMornings ?? source.avoidEarlyMorning,
      DEFAULT_ONBOARDING_PREFERENCES.preferFewerEarlyMornings,
    ),
    preferAvoidCampusTransfers: booleanFrom(
      source.preferAvoidCampusTransfers,
      DEFAULT_ONBOARDING_PREFERENCES.preferAvoidCampusTransfers,
    ),
    residentCampus: source.residentCampus === '高新区' ? '高新区' : '本部',
    showUpdatePopup: booleanFrom(
      source.showUpdatePopup,
      DEFAULT_ONBOARDING_PREFERENCES.showUpdatePopup,
    ),
  };
}

function normalizeState(value: unknown): OnboardingState {
  const source = value && typeof value === 'object'
    ? value as Partial<Record<keyof OnboardingState, unknown>>
    : {};

  return {
    wizardCompleted: booleanFrom(source.wizardCompleted, DEFAULT_ONBOARDING_STATE.wizardCompleted),
    tourCompleted: booleanFrom(source.tourCompleted, DEFAULT_ONBOARDING_STATE.tourCompleted),
    skipped: booleanFrom(source.skipped, DEFAULT_ONBOARDING_STATE.skipped),
    preferences: normalizePreferences(source.preferences),
  };
}

export function readOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_ONBOARDING_STATE;

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    const legacyCompleted = window.localStorage.getItem(LEGACY_COMPLETED_KEY) === 'true';
    if (!raw) {
      return legacyCompleted
        ? { ...DEFAULT_ONBOARDING_STATE, wizardCompleted: true, tourCompleted: true }
        : DEFAULT_ONBOARDING_STATE;
    }

    const parsed = readPersistedState(JSON.parse(raw));
    return {
      ...parsed,
      wizardCompleted: parsed.wizardCompleted || legacyCompleted,
    };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

function saveOnboardingState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ onboarding: state }));
    window.localStorage.setItem(LEGACY_COMPLETED_KEY, state.wizardCompleted ? 'true' : 'false');
  } catch {
    // 隐私模式或存储空间不足时保留本次会话状态。
  }
}

function readPersistedState(raw: unknown): OnboardingState {
  const maybeWrapped = raw && typeof raw === 'object'
    ? raw as { onboarding?: unknown }
    : {};
  return normalizeState(maybeWrapped.onboarding ?? raw);
}

export function useOnboarding() {
  const [initial] = useState(() => {
    const state = readOnboardingState();
    return {
      state,
      stage: state.wizardCompleted ? 'hidden' as const : 'wizard' as const,
    };
  });
  const [state, setState] = useState(initial.state);
  const [stage, setStage] = useState<OnboardingStage>(initial.stage);
  const [tourEntryMode, setTourEntryMode] = useState<OnboardingTourEntryMode>('wizard');

  const persist = useCallback((next: OnboardingState) => {
    setState(next);
    saveOnboardingState(next);
  }, []);

  const finishWizard = useCallback((preferences: OnboardingPreferences, startTour: boolean) => {
    const next = {
      ...state,
      wizardCompleted: true,
      skipped: !startTour,
      preferences,
    };
    persist(next);
    setTourEntryMode('wizard');
    setStage(startTour ? 'tour' : 'hidden');
  }, [persist, state]);

  const skipWizard = useCallback(() => {
    persist({
      ...state,
      wizardCompleted: true,
      skipped: true,
    });
    setStage('hidden');
  }, [persist, state]);

  const finishTour = useCallback(() => {
    persist({
      ...state,
      wizardCompleted: true,
      tourCompleted: true,
      skipped: false,
    });
    setStage('hidden');
  }, [persist, state]);

  const skipTour = useCallback(() => {
    persist({
      ...state,
      wizardCompleted: true,
      skipped: true,
    });
    setStage('hidden');
  }, [persist, state]);

  const startTour = useCallback(() => {
    setTourEntryMode('manual');
    setStage('tour');
  }, []);

  return {
    state,
    stage,
    tourEntryMode,
    finishWizard,
    skipWizard,
    finishTour,
    skipTour,
    startTour,
  };
}

export function parseOnboardingStorage(raw: string): OnboardingState {
  return readPersistedState(JSON.parse(raw));
}
