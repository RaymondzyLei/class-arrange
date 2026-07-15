import { describe, expect, it } from 'vitest';
import {
  formatTermDateRange,
  getCalendarDatesForSelection,
  getSpecialDateSummaries,
  getVisibleWeekdays,
  getWeekLabel,
  getWeekRange,
  TERM_CALENDAR,
} from './termCalendar';

describe('TERM_CALENDAR', () => {
  it('keeps 2026 fall term-specific data centralized', () => {
    expect(TERM_CALENDAR.termId).toBe('2026-fall');
    expect(TERM_CALENDAR.termStartDate).toBe('2026-08-30');
    expect(TERM_CALENDAR.termEndDate).toBe('2027-01-15');
    expect(TERM_CALENDAR.weekStartDate).toBe('2026-08-31');
    expect(TERM_CALENDAR.weekCount).toBe(20);
  });

  it('keeps the displayed range fixed to the API bounds for every week selection', () => {
    expect(formatTermDateRange()).toBe('2026.08.30 - 2027.01.15');
  });

  it('clips the final teaching week to the API end date', () => {
    expect(getWeekRange(1)).toEqual(['2026-08-31', '2026-09-06']);
    expect(getWeekRange(20)).toEqual(['2027-01-11', '2027-01-15']);
    expect(getCalendarDatesForSelection(20).map((info) => info.iso)).toEqual([
      '2027-01-11',
      '2027-01-12',
      '2027-01-13',
      '2027-01-14',
      '2027-01-15',
    ]);
    expect(getWeekLabel('all')).toBe('全部周次');
    expect(getWeekLabel(4)).toBe('第4周');
  });

  it('keeps all weekday columns while clipping dates in a partial final week', () => {
    const thursdayEnd = {
      ...TERM_CALENDAR,
      termEndDate: '2027-01-14',
    };

    expect(getVisibleWeekdays('all', thursdayEnd)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getVisibleWeekdays(20, thursdayEnd)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getCalendarDatesForSelection(20, thursdayEnd).map((info) => info.iso)).toEqual([
      '2027-01-11',
      '2027-01-12',
      '2027-01-13',
      '2027-01-14',
    ]);
  });

  it('marks holidays as non-instructional days', () => {
    const week5 = getCalendarDatesForSelection(5);
    const holiday = week5.find((info) => info.iso === '2026-10-01');
    expect(holiday?.holiday?.label).toBe('休');
    expect(holiday?.instructional).toBe(false);
  });

  it('maps makeup days to the configured effective weekday and week', () => {
    const allDates = getCalendarDatesForSelection('all');
    const schoolAnniversaryMakeup = allDates.find((info) => info.iso === '2026-09-20');
    const octoberMakeup = allDates.find((info) => info.iso === '2026-10-10');

    expect(schoolAnniversaryMakeup?.makeup?.label).toBe('补周五课');
    expect(schoolAnniversaryMakeup?.weekday).toBe(7);
    expect(schoolAnniversaryMakeup?.effectiveWeekday).toBe(5);
    expect(schoolAnniversaryMakeup?.effectiveWeek).toBe(4);

    expect(octoberMakeup?.makeup?.label).toBe('补周二课');
    expect(octoberMakeup?.effectiveWeekday).toBe(2);
  });

  it('summarizes special dates for week and all-week views', () => {
    expect(getSpecialDateSummaries(3)).toContain('9.20 补周五课');
    expect(getSpecialDateSummaries(4)).toContain('9.25 休');
    expect(getSpecialDateSummaries('all')).toContain('10.10 补周二课');
    expect(getSpecialDateSummaries('all')).toContain('1.1 休');
  });
});
