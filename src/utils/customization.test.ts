import { describe, expect, it } from 'vitest';
import {
  ARRANGEMENT_DISPLAY_COUNT_OPTIONS,
  CALCULATION_MODE_OPTIONS,
  DEFAULT_CUSTOM_SETTINGS,
  normalizeCustomScheduleSettings,
  parseCustomScheduleSettings,
} from './customization';

describe('custom schedule settings persistence', () => {
  it('exposes the shared automatic/manual labels and explanations', () => {
    expect(CALCULATION_MODE_OPTIONS).toEqual([
      {
        value: 'auto',
        label: '自动排课',
        description: '课程或排课偏好变化后自动重新计算。',
      },
      {
        value: 'manual',
        label: '手动开始排课',
        description: '修改后保留当前课表，按需点击开始或重新计算。',
      },
    ]);
  });

  it('defaults new and missing calculation modes to auto', () => {
    expect(DEFAULT_CUSTOM_SETTINGS.calculationMode).toBe('auto');
    expect(normalizeCustomScheduleSettings({}).calculationMode).toBe('auto');
    expect(normalizeCustomScheduleSettings(null).calculationMode).toBe('auto');
  });

  it('defaults campus transfer avoidance to enabled with main campus residency', () => {
    expect(DEFAULT_CUSTOM_SETTINGS.preferAvoidCampusTransfers).toBe(true);
    expect(DEFAULT_CUSTOM_SETTINGS.residentCampus).toBe('本部');
    expect(normalizeCustomScheduleSettings({})).toMatchObject({
      preferAvoidCampusTransfers: true,
      residentCampus: '本部',
    });
  });

  it('uses eight displayed arrangements by default and accepts only supported counts', () => {
    expect(ARRANGEMENT_DISPLAY_COUNT_OPTIONS.map(({ value }) => value))
      .toEqual([2, 4, 8, 12, 16]);
    expect(DEFAULT_CUSTOM_SETTINGS.arrangementDisplayCount).toBe(8);
    expect(normalizeCustomScheduleSettings({}).arrangementDisplayCount).toBe(8);
    expect(normalizeCustomScheduleSettings({ arrangementDisplayCount: 2 }).arrangementDisplayCount)
      .toBe(2);
    expect(normalizeCustomScheduleSettings({ arrangementDisplayCount: 16 }).arrangementDisplayCount)
      .toBe(16);
    expect(normalizeCustomScheduleSettings({ arrangementDisplayCount: 100 }).arrangementDisplayCount)
      .toBe(8);
    expect(normalizeCustomScheduleSettings({ arrangementDisplayCount: '12' }).arrangementDisplayCount)
      .toBe(8);
  });

  it('defaults time-group merging to disabled and preserves an explicit opt-in', () => {
    expect(DEFAULT_CUSTOM_SETTINGS.mergeAllTimeGroups).toBe(false);
    expect(normalizeCustomScheduleSettings({}).mergeAllTimeGroups).toBe(false);
    expect(normalizeCustomScheduleSettings({ mergeAllTimeGroups: true }).mergeAllTimeGroups)
      .toBe(true);
    expect(normalizeCustomScheduleSettings({ mergeAllTimeGroups: 'yes' }).mergeAllTimeGroups)
      .toBe(false);
  });

  it('preserves valid campus preferences and normalizes an invalid residence', () => {
    expect(normalizeCustomScheduleSettings({
      preferAvoidCampusTransfers: false,
      residentCampus: '高新区',
    })).toMatchObject({
      preferAvoidCampusTransfers: false,
      residentCampus: '高新区',
    });
    expect(normalizeCustomScheduleSettings({ residentCampus: '其他' }).residentCampus)
      .toBe('本部');
  });

  it('preserves manual and normalizes invalid persisted modes to auto', () => {
    expect(normalizeCustomScheduleSettings({ calculationMode: 'manual' }).calculationMode)
      .toBe('manual');
    expect(normalizeCustomScheduleSettings({ calculationMode: 'auto' }).calculationMode)
      .toBe('auto');
    expect(normalizeCustomScheduleSettings({ calculationMode: 'later' }).calculationMode)
      .toBe('auto');
  });

  it('retains legacy preference migration and blocked-slot validation', () => {
    expect(parseCustomScheduleSettings(JSON.stringify({
      schedulePreference: 'half-day',
      blockedSlots: ['2-6', 'bad', '2-6', '1-1'],
    }))).toEqual({
      calculationMode: 'auto',
      arrangementDisplayCount: 8,
      mergeAllTimeGroups: false,
      preferHalfDay: true,
      preferFewerEarlyMornings: true,
      preferAvoidCampusTransfers: true,
      residentCampus: '本部',
      blockedSlots: ['1-1', '2-6'],
    });
  });
});
