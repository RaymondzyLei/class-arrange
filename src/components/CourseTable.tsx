import { Button, Slider } from 'antd';
import { useMemo, type CSSProperties, type Ref } from 'react';
import type { CourseGroup } from '@/types';
import { DAYS, PERIODS, DAY_LABELS } from '@/constants/grid';
import { formatWeeks, isWeekInArray } from '@/utils/weeks';
import { courseColor, type CourseColor } from '@/utils/courseColor';
import {
  formatDateRange,
  formatShortDate,
  getCalendarDatesForSelection,
  getWeekOptions,
  TERM_CALENDAR,
  type CalendarDateInfo,
  type WeekSelection,
} from '@/config/termCalendar';
import { DownloadIcon, MoonIcon, SunIcon, WarningIcon } from './icons';
import SelectWithChevron from './SelectWithChevron';

interface Props {
  weekSelection: WeekSelection;
  setWeekSelection: (value: WeekSelection) => void;
  groups: CourseGroup[];
  exportRef?: Ref<HTMLDivElement>;
  onOpenDetail: (id: string) => void;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  onExport: () => void | Promise<void>;
  exporting?: boolean;
}

interface TimetableViewProps {
  weekSelection: WeekSelection;
  groups: CourseGroup[];
  exportMode?: boolean;
  themeMode: 'light' | 'dark';
  onOpenDetail?: (id: string) => void;
}

interface TimetableEntry {
  id: string;
  groupKey: string;
  sectionLabel: string;
  courseName: string;
  teachers: string;
  credits: number;
  weeksText: string;
  periodsText: string;
  room: string;
  displayDay: number;
  start: number;
  end: number;
  periods: number[];
  span: number;
  activeDates: string[];
  specialLabels: string[];
  color: CourseColor;
  conflict: boolean;
}

interface MutableTimetableEntry extends TimetableEntry {
  activeDateSet: Set<string>;
  specialLabelSet: Set<string>;
}

const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '07:50', end: '08:35' },
  2: { start: '08:40', end: '09:25' },
  3: { start: '09:45', end: '10:30' },
  4: { start: '10:35', end: '11:20' },
  5: { start: '11:25', end: '12:10' },
  6: { start: '14:00', end: '14:45' },
  7: { start: '14:50', end: '15:35' },
  8: { start: '15:55', end: '16:40' },
  9: { start: '16:45', end: '17:30' },
  10: { start: '17:35', end: '18:20' },
  11: { start: '19:30', end: '20:15' },
  12: { start: '20:20', end: '21:05' },
  13: { start: '21:10', end: '21:55' },
};

const BAND_STARTS: Record<number, { label: string; rowSpan: number }> = {
  1: { label: '上午', rowSpan: 5 },
  6: { label: '下午', rowSpan: 5 },
  11: { label: '晚上', rowSpan: 3 },
};

function sectionLabelForGroup(g: CourseGroup): string {
  if (g.sections.length <= 1) return g.sectionIds[0] ?? g.courseCode;
  return `${g.courseCode}.(${g.sectionIds
    .map((id) => id.slice(id.lastIndexOf('.') + 1))
    .sort()
    .join(',')})`;
}

function splitConsecutivePeriods(periods: number[]): number[][] {
  const sorted = [...new Set(periods)].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const p of sorted) {
    const last = runs[runs.length - 1];
    if (!last || p !== last[last.length - 1] + 1) runs.push([p]);
    else last.push(p);
  }
  return runs;
}

function keyFor(day: number, period: number): string {
  return `${day}-${period}`;
}

function periodOverlaps(a: TimetableEntry, b: TimetableEntry): boolean {
  return a.periods.some((period) => b.periods.includes(period));
}

function dateOverlaps(a: TimetableEntry, b: TimetableEntry): boolean {
  const dates = new Set(a.activeDates);
  return b.activeDates.some((date) => dates.has(date));
}

function markConflicts(entries: TimetableEntry[]): TimetableEntry[] {
  const conflictIds = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (a.groupKey === b.groupKey) continue;
      if (a.displayDay !== b.displayDay) continue;
      if (!periodOverlaps(a, b)) continue;
      if (!dateOverlaps(a, b)) continue;
      conflictIds.add(a.id);
      conflictIds.add(b.id);
    }
  }
  return entries.map((entry) => ({ ...entry, conflict: conflictIds.has(entry.id) }));
}

function buildEntries(
  groups: CourseGroup[],
  weekSelection: WeekSelection,
  themeMode: 'light' | 'dark',
): TimetableEntry[] {
  const dates = getCalendarDatesForSelection(weekSelection).filter((date) => date.instructional);
  const entries = new Map<string, MutableTimetableEntry>();

  for (const group of groups) {
    const color = courseColor(group.key, themeMode);
    for (let slotIndex = 0; slotIndex < group.schedule.length; slotIndex += 1) {
      const slot = group.schedule[slotIndex];
      if (slot.day < 1 || slot.day > 7) continue;
      const runs = splitConsecutivePeriods(slot.periods.filter((p) => p >= 1 && p <= 13));
      for (const date of dates) {
        if (date.effectiveWeekday !== slot.day) continue;
        if (!isWeekInArray(slot.weeks, date.effectiveWeek)) continue;
        for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
          const periods = runs[runIndex];
          const start = periods[0];
          const end = periods[periods.length - 1];
          const id = [
            group.key,
            slotIndex,
            runIndex,
            date.weekday,
            date.effectiveWeekday,
            slot.weeks.join('_'),
            periods.join('_'),
          ].join('-');
          let entry = entries.get(id);
          if (!entry) {
            entry = {
              id,
              groupKey: group.key,
              sectionLabel: sectionLabelForGroup(group),
              courseName: group.courseName,
              teachers: group.teachers.join('、') || '教师未定',
              credits: group.sections[0]?.credits ?? 0,
              weeksText: formatWeeks(slot.weeks),
              periodsText: periods.join(','),
              room: group.sections.length > 1 ? '多班次' : slot.room,
              displayDay: date.weekday,
              start,
              end,
              periods,
              span: end - start + 1,
              activeDates: [],
              specialLabels: [],
              activeDateSet: new Set<string>(),
              specialLabelSet: new Set<string>(),
              color,
              conflict: false,
            };
            entries.set(id, entry);
          }
          entry.activeDateSet.add(date.iso);
          if (date.makeup) entry.specialLabelSet.add(date.makeup.label);
        }
      }
    }
  }

  const normalized = [...entries.values()].map((entry) => ({
    ...entry,
    activeDates: [...entry.activeDateSet].sort(),
    specialLabels: [...entry.specialLabelSet],
  }));
  return markConflicts(normalized);
}

function buildEntryMaps(entries: TimetableEntry[]) {
  const starts = new Map<string, TimetableEntry[]>();
  const covers = new Map<string, TimetableEntry[]>();

  for (const entry of entries) {
    const startKey = keyFor(entry.displayDay, entry.start);
    starts.set(startKey, [...(starts.get(startKey) ?? []), entry]);

    for (const period of entry.periods) {
      const coverKey = keyFor(entry.displayDay, period);
      covers.set(coverKey, [...(covers.get(coverKey) ?? []), entry]);
    }
  }

  return { starts, covers };
}

function sameEntries(a: TimetableEntry[], b: TimetableEntry[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((entry) => entry.id));
  return b.every((entry) => ids.has(entry.id));
}

function sameNumberArray(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function getRowSpanEntries(
  period: number,
  covering: TimetableEntry[],
  starting: TimetableEntry[],
  covers: Map<string, TimetableEntry[]>,
): { entries: TimetableEntry[]; span: number } | null {
  if (covering.length === 0 || starting.length === 0) return null;
  if (!sameEntries(covering, starting)) return null;
  if (starting.some((entry) => entry.start !== period || entry.conflict)) return null;
  const [first] = starting;
  if (starting.some((entry) => entry.end !== first.end || !sameNumberArray(entry.periods, first.periods))) {
    return null;
  }
  for (const p of first.periods) {
    if (!sameEntries(covers.get(keyFor(first.displayDay, p)) ?? [], starting)) {
      return null;
    }
  }
  return { entries: starting, span: first.span };
}

function entryStyle(entry: TimetableEntry): CSSProperties {
  return {
    '--block-stripe': entry.color.stripe,
    '--block-bg': entry.color.bg,
    '--block-fg': entry.color.fg,
  } as CSSProperties;
}

function TimetableCell({
  day,
  entries,
  rowSpan,
  onOpenDetail,
}: {
  day: number;
  entries: TimetableEntry[];
  rowSpan?: number;
  onOpenDetail?: (id: string) => void;
}) {
  const hasEntries = entries.length > 0;
  const isConflict = entries.some((entry) => entry.conflict);
  const className = [
    'timetable__cell',
    day === 1 ? 'timetable__cell--first-day' : '',
    hasEntries ? 'timetable__cell--has' : 'timetable__cell--empty',
    isConflict ? 'timetable__cell--conflict' : '',
    hasEntries && !isConflict && entries.length === 1 ? 'timetable__cell--single' : '',
    rowSpan ? 'timetable__cell--span' : '',
  ].filter(Boolean).join(' ');

  return (
    <td className={className} rowSpan={rowSpan}>
      {isConflict ? <WarningIcon className="timetable__warning-icon" /> : null}
      <div className="timetable__courses">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`timetable-course${entry.conflict ? ' timetable-course--conflict' : ''}`}
            style={entryStyle(entry)}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail?.(entry.groupKey);
            }}
          >
            <span className="timetable-course__number">
              {entry.sectionLabel} [{entry.credits}]
            </span>
            <span className="timetable-course__title">{entry.courseName}</span>
            <span className="timetable-course__teacher">{entry.teachers}</span>
            <span className="timetable-course__time">
              <span>{entry.weeksText}</span>
              <span>{entry.periodsText}</span>
            </span>
            {entry.specialLabels.length ? (
              <span className="timetable-course__special">{entry.specialLabels.join('、')}</span>
            ) : null}
            {entry.room ? <span className="timetable-course__room">{entry.room}</span> : null}
          </button>
        ))}
      </div>
    </td>
  );
}

function DayHead({ day, info }: { day: number; info?: CalendarDateInfo }) {
  return (
    <th
      scope="col"
      className={[
        'timetable__day-head',
        day === 1 ? 'timetable__day-head--first' : '',
        day >= 6 ? 'timetable__day-head--weekend' : '',
        info?.holiday ? 'timetable__day-head--holiday' : '',
        info?.makeup ? 'timetable__day-head--makeup' : '',
      ].filter(Boolean).join(' ')}
    >
      <span className="timetable__day-title">{DAY_LABELS[day]}</span>
      {info ? <span className="timetable__day-date">{formatShortDate(info.iso)}</span> : null}
      {info?.holiday ? <span className="timetable__day-badge">休</span> : null}
      {info?.makeup ? <span className="timetable__day-badge timetable__day-badge--makeup">{info.makeup.label}</span> : null}
    </th>
  );
}

function TimetableView({ weekSelection, groups, exportMode = false, themeMode, onOpenDetail }: TimetableViewProps) {
  const colorTheme = exportMode ? 'light' : themeMode;
  const entries = useMemo(
    () => buildEntries(groups, weekSelection, colorTheme),
    [groups, weekSelection, colorTheme],
  );
  const { starts, covers } = useMemo(() => buildEntryMaps(entries), [entries]);
  const selectedWeekDates = useMemo(
    () => (weekSelection === 'all' ? [] : getCalendarDatesForSelection(weekSelection)),
    [weekSelection],
  );
  const dateByWeekday = new Map(selectedWeekDates.map((info) => [info.weekday, info]));
  const skipped = new Set<string>();

  return (
    <div className={`timetable-shell${exportMode ? ' timetable-shell--export' : ''}`}>
      <table className="timetable">
        <thead>
          <tr>
            <th className="timetable__head-spacer" colSpan={2} />
            {DAYS.map((day) => (
              <DayHead key={day} day={day} info={dateByWeekday.get(day)} />
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr
              key={period}
              className={`timetable__row${BAND_STARTS[period] ? ' timetable__row--band-start' : ''}`}
            >
              {BAND_STARTS[period] ? (
                <th scope="row" rowSpan={BAND_STARTS[period].rowSpan} className="timetable__band-cell">
                  {BAND_STARTS[period].label}
                </th>
              ) : null}
              <th scope="row" className="timetable__period-cell">
                <span className="timetable__period-number">{period}</span>
                <span className="timetable__period-time">
                  {PERIOD_TIMES[period].start}
                  <br />
                  {PERIOD_TIMES[period].end}
                </span>
              </th>
              {DAYS.map((day) => {
                const cellKey = keyFor(day, period);
                if (skipped.has(cellKey)) return null;

                const covering = covers.get(cellKey) ?? [];
                const starting = starts.get(cellKey) ?? [];
                const rowSpanBlock = getRowSpanEntries(period, covering, starting, covers);

                if (rowSpanBlock) {
                  const [first] = rowSpanBlock.entries;
                  for (let p = first.start + 1; p <= first.end; p += 1) {
                    skipped.add(keyFor(day, p));
                  }
                  return (
                    <TimetableCell
                      key={day}
                      day={day}
                      entries={rowSpanBlock.entries}
                      rowSpan={rowSpanBlock.span}
                      onOpenDetail={onOpenDetail}
                    />
                  );
                }

                return (
                  <TimetableCell
                    key={day}
                    day={day}
                    entries={starting}
                    onOpenDetail={onOpenDetail}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CourseTable({
  weekSelection,
  setWeekSelection,
  groups,
  exportRef,
  onOpenDetail,
  themeMode,
  onToggleTheme,
  onExport,
  exporting = false,
}: Props) {
  const toggleLabel = themeMode === 'dark' ? '切换到亮色模式' : '切换到暗色模式';
  const weekOptions = useMemo(() => getWeekOptions(), []);
  const sliderWeek = typeof weekSelection === 'number' ? weekSelection : 1;

  return (
    <div className="panel-inner course-table-wrap">
      <div className="course-table__header no-print">
        <span className="course-table__header-label">当前周次</span>
        <div className="week-slider-wrap">
          <Slider
            className="week-slider"
            min={1}
            max={TERM_CALENDAR.weekCount}
            value={sliderWeek}
            included={false}
            tooltip={{ open: false }}
            onChange={(value) => {
              if (typeof value === 'number') setWeekSelection(value);
            }}
          />
        </div>
        <div className="week-select-wrap">
          <SelectWithChevron
            className="week-select"
            value={weekSelection}
            onChange={(value) => setWeekSelection(value as WeekSelection)}
            options={weekOptions}
            popupMatchSelectWidth={220}
          />
        </div>
        <span className="course-table__date-range">{formatDateRange(weekSelection)}</span>
        <div className="course-table__actions no-print">
          <Button
            className="theme-toggle"
            type="text"
            size="middle"
            onClick={onToggleTheme}
            aria-label={toggleLabel}
          >
            {themeMode === 'dark'
              ? <SunIcon className="course-table__icon" />
              : <MoonIcon className="course-table__icon" />}
          </Button>
          <Button
            className="course-table__export-button"
            type="primary"
            onClick={onExport}
            loading={exporting}
            icon={<DownloadIcon className="course-table__button-icon" />}
          >
            <span className="course-table__export-label">导出图片</span>
          </Button>
        </div>
      </div>

      <div className="course-table__scroll">
        <TimetableView
          weekSelection={weekSelection}
          groups={groups}
          themeMode={themeMode}
          onOpenDetail={onOpenDetail}
        />
      </div>

      <div className="timetable-export-stage" ref={exportRef}>
        <TimetableView
          weekSelection={weekSelection}
          groups={groups}
          exportMode
          themeMode="light"
        />
      </div>
    </div>
  );
}
