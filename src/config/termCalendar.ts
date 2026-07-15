export type ISODate = string;
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type WeekSelection = 'all' | number;

export interface HolidayInfo {
  label: '休';
  name?: string;
}

export interface MakeupDayInfo {
  label: string;
  useWeekday: Weekday;
  useWeek?: number;
}

export interface TermCalendar {
  termId: string;
  termName: string;
  termStartDate: ISODate;
  termEndDate: ISODate;
  weekStartDate: ISODate;
  weekCount: number;
  sourceUrl: string;
  holidays: Record<ISODate, HolidayInfo>;
  makeupDays: Record<ISODate, MakeupDayInfo>;
}

export interface CalendarDateInfo {
  iso: ISODate;
  week: number;
  weekday: Weekday;
  effectiveWeek: number;
  effectiveWeekday: Weekday;
  holiday?: HolidayInfo;
  makeup?: MakeupDayInfo;
  instructional: boolean;
}

interface CalendarDateOptions {
  includeSpecialDates?: boolean;
}

/** 学期相关日期配置集中在这里。
 *  后续换学期时只替换本对象：起始周一、教学周数、休假日、补课日和来源 URL。 */
export const TERM_CALENDAR: TermCalendar = {
  termId: '2026-fall',
  termName: '2026年秋季学期',
  termStartDate: '2026-08-30',
  termEndDate: '2027-01-15',
  weekStartDate: '2026-08-31',
  weekCount: 20,
  sourceUrl: 'https://www.teach.ustc.edu.cn/calendar/20135.html',
  holidays: {
    '2026-09-25': { label: '休', name: '中秋节' },
    '2026-09-26': { label: '休', name: '中秋假期' },
    '2026-09-27': { label: '休', name: '中秋假期' },
    '2026-10-01': { label: '休', name: '国庆节' },
    '2026-10-02': { label: '休', name: '国庆假期' },
    '2026-10-03': { label: '休', name: '国庆假期' },
    '2026-10-04': { label: '休', name: '国庆假期' },
    '2026-10-05': { label: '休', name: '国庆假期' },
    '2026-10-06': { label: '休', name: '国庆假期' },
    '2026-10-07': { label: '休', name: '国庆假期' },
    '2027-01-01': { label: '休', name: '元旦' },
    '2027-01-02': { label: '休', name: '元旦假期' },
    '2027-01-03': { label: '休', name: '元旦假期' },
  },
  makeupDays: {
    '2026-09-20': { label: '补周五课', useWeekday: 5, useWeek: 4 },
    '2026-10-10': { label: '补周二课', useWeekday: 2 },
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISODate(iso: ISODate): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function getTermEndDate(calendar = TERM_CALENDAR): ISODate {
  return calendar.termEndDate;
}

export function getWeekRange(week: number, calendar = TERM_CALENDAR): [ISODate, ISODate] {
  const start = addDays(calendar.weekStartDate, (week - 1) * 7);
  const fullWeekEnd = addDays(start, 6);
  return [start, fullWeekEnd < calendar.termEndDate ? fullWeekEnd : calendar.termEndDate];
}

export function formatISODate(iso: ISODate): string {
  const [year, month, day] = iso.split('-');
  return `${year}.${month}.${day}`;
}

export function formatShortDate(iso: ISODate): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${month}.${day}`;
}

export function formatTermDateRange(calendar = TERM_CALENDAR): string {
  return `${formatISODate(calendar.termStartDate)} - ${formatISODate(calendar.termEndDate)}`;
}

export function getWeekdayForISO(iso: ISODate): Weekday {
  const jsDay = parseISODate(iso).getUTCDay();
  return (jsDay === 0 ? 7 : jsDay) as Weekday;
}

export function getWeekNumberForISO(iso: ISODate, calendar = TERM_CALENDAR): number {
  const diff = parseISODate(iso).getTime() - parseISODate(calendar.weekStartDate).getTime();
  return Math.floor(diff / (7 * MS_PER_DAY)) + 1;
}

function buildDateInfo(iso: ISODate, calendar: TermCalendar, options: CalendarDateOptions): CalendarDateInfo {
  const week = getWeekNumberForISO(iso, calendar);
  const weekday = getWeekdayForISO(iso);
  const includeSpecialDates = options.includeSpecialDates ?? true;
  const holiday = includeSpecialDates ? calendar.holidays[iso] : undefined;
  const makeup = includeSpecialDates ? calendar.makeupDays[iso] : undefined;
  const info: CalendarDateInfo = {
    iso,
    week,
    weekday,
    effectiveWeek: makeup?.useWeek ?? week,
    effectiveWeekday: makeup?.useWeekday ?? weekday,
    instructional: !holiday,
  };
  if (holiday) info.holiday = holiday;
  if (makeup) info.makeup = makeup;
  return info;
}

export function getCalendarDatesForSelection(
  selection: WeekSelection,
  calendar = TERM_CALENDAR,
  options: CalendarDateOptions = {},
): CalendarDateInfo[] {
  const [start, end] = selection === 'all'
    ? [calendar.termStartDate, calendar.termEndDate]
    : getWeekRange(selection, calendar);
  const days = Math.max(
    0,
    Math.floor((parseISODate(end).getTime() - parseISODate(start).getTime()) / MS_PER_DAY) + 1,
  );
  return Array.from({ length: days }, (_, index) => buildDateInfo(addDays(start, index), calendar, options));
}

export function getVisibleWeekdays(
  _selection: WeekSelection,
  _calendar = TERM_CALENDAR,
): Weekday[] {
  return [1, 2, 3, 4, 5, 6, 7];
}

export function getWeekOptions(calendar = TERM_CALENDAR): Array<{ label: string; value: WeekSelection }> {
  return [
    { label: '全部周次', value: 'all' },
    ...Array.from({ length: calendar.weekCount }, (_, index) => ({
      label: `第${index + 1}周`,
      value: index + 1,
    })),
  ];
}

export function getWeekLabel(selection: WeekSelection): string {
  return selection === 'all' ? '全部周次' : `第${selection}周`;
}

export function getSpecialDateSummaries(selection: WeekSelection, calendar = TERM_CALENDAR): string[] {
  return getCalendarDatesForSelection(selection, calendar)
    .filter((info) => info.holiday || info.makeup)
    .map((info) => {
      const label = info.makeup?.label ?? info.holiday?.label ?? '';
      return `${formatShortDate(info.iso)} ${label}`;
    });
}
