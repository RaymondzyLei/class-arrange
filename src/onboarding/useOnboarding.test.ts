import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ONBOARDING_PREFERENCES,
  parseOnboardingStorage,
} from './useOnboarding';

describe('onboarding calculation-mode persistence', () => {
  it('defaults new and legacy preferences to automatic calculation', () => {
    expect(DEFAULT_ONBOARDING_PREFERENCES.calculationMode).toBe('auto');
    expect(parseOnboardingStorage(JSON.stringify({
      onboarding: {
        wizardCompleted: false,
        preferences: {},
      },
    })).preferences.calculationMode).toBe('auto');
  });

  it('preserves manual and rejects invalid persisted modes', () => {
    expect(parseOnboardingStorage(JSON.stringify({
      preferences: { calculationMode: 'manual' },
    })).preferences.calculationMode).toBe('manual');
    expect(parseOnboardingStorage(JSON.stringify({
      preferences: { calculationMode: 'unexpected' },
    })).preferences.calculationMode).toBe('auto');
  });

  it('keeps the legacy onboarding preference aliases', () => {
    expect(parseOnboardingStorage(JSON.stringify({
      preferences: {
        preferCompactSchedule: true,
        avoidEarlyMorning: false,
      },
    })).preferences).toEqual({
      calculationMode: 'auto',
      preferHalfDay: true,
      preferFewerEarlyMornings: false,
    });
  });
});
