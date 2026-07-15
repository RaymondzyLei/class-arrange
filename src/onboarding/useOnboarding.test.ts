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

  it('defaults campus transfer avoidance to enabled with main campus residency', () => {
    const preferences = parseOnboardingStorage(JSON.stringify({
      onboarding: { preferences: {} },
    })).preferences;

    expect(DEFAULT_ONBOARDING_PREFERENCES).toMatchObject({
      preferAvoidCampusTransfers: true,
      residentCampus: '本部',
      showUpdatePopup: true,
    });
    expect(preferences).toMatchObject({
      preferAvoidCampusTransfers: true,
      residentCampus: '本部',
      showUpdatePopup: true,
    });
  });

  it('preserves valid campus preferences and rejects other as a residence', () => {
    expect(parseOnboardingStorage(JSON.stringify({
      preferences: {
        preferAvoidCampusTransfers: false,
        residentCampus: '高新区',
      },
    })).preferences).toMatchObject({
      preferAvoidCampusTransfers: false,
      residentCampus: '高新区',
    });
    expect(parseOnboardingStorage(JSON.stringify({
      preferences: { residentCampus: '其他' },
    })).preferences.residentCampus).toBe('本部');
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
      preferAvoidCampusTransfers: true,
      residentCampus: '本部',
      showUpdatePopup: true,
    });
  });

  it('preserves the update-popup preference when explicitly disabled', () => {
    expect(parseOnboardingStorage(JSON.stringify({
      preferences: { showUpdatePopup: false },
    })).preferences.showUpdatePopup).toBe(false);
  });
});
