import { Button, Slider } from 'antd';
import { useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import type { CourseGroup } from '@/types';
import { DAYS, PERIODS, DAY_LABELS } from '@/constants/grid';
import { formatWeeks, isWeekInArray } from '@/utils/weeks';
import { courseColor, type CourseColor } from '@/utils/courseColor';
import { formatTeacherList } from '@/utils/teachers';
import {
  assignTimetableLanes,
  getMobileContainmentGroups,
  getMobileContainmentMetrics,
  getMobileContainmentLayers,
  getParallelLaneSizing,
  type TimetableRangeEntry,
} from '@/utils/timetableLayout';
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
import { GearIcon } from './icons';
import SelectWithChevron from './SelectWithChevron';
import { blockedSlotKey } from '@/utils/customization';
import { PROJECT_LINKS } from '@/content/projectCredits';
import BottomModal from './BottomModal';
import ContributorList from './ContributorList';

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
  blockedSlots: string[];
  onOpenCustomization: () => void;
}

interface TimetableViewProps {
  weekSelection: WeekSelection;
  groups: CourseGroup[];
  exportMode?: boolean;
  themeMode: 'light' | 'dark';
  onOpenDetail?: (id: string) => void;
  blockedSlots: string[];
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

function markConflicts(entries: TimetableEntry[], blockedSlots: Set<string>): TimetableEntry[] {
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
  return entries.map((entry) => ({
    ...entry,
    conflict: conflictIds.has(entry.id)
      || entry.periods.some((period) =>
        blockedSlots.has(blockedSlotKey(entry.displayDay, period)),
      ),
  }));
}

interface BlockedTimetableEntry extends TimetableRangeEntry {
  color: CourseColor;
}

const BLOCKED_COLOR: CourseColor = {
  name: 'blocked',
  stripe: 'var(--timetable-placeholder-stripe)',
  bg: 'var(--timetable-placeholder-bg)',
  fg: 'var(--timetable-placeholder-fg)',
};

function buildEntries(
  groups: CourseGroup[],
  weekSelection: WeekSelection,
  themeMode: 'light' | 'dark',
  blockedSlots: Set<string>,
): TimetableEntry[] {
  const dates = getCalendarDatesForSelection(weekSelection, TERM_CALENDAR, {
    includeSpecialDates: weekSelection !== 'all',
  }).filter((date) => date.instructional);
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
              teachers: formatTeacherList(group.teachers),
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
  return markConflicts(normalized, blockedSlots);
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

function getRowSpanEntries(
  period: number,
  covering: TimetableEntry[],
  starting: TimetableEntry[],
  covers: Map<string, TimetableEntry[]>,
  blockedSlots: Set<string>,
): { entries: TimetableEntry[]; span: number; blockedPeriods: number[] } | null {
  if (covering.length === 0 || starting.length === 0) return null;
  if (covering.some((entry) => entry.start < period)) return null;

  const day = starting[0].displayDay;
  const cluster = new Map(starting.map((entry) => [entry.id, entry]));
  const blockedPeriods: number[] = [];
  let clusterEnd = Math.max(...starting.map((entry) => entry.end));

  // Build the complete overlapping cluster, including courses that start later
  // inside another course's span. Each entry keeps its own vertical time range.
  for (let p = period; p <= clusterEnd; p += 1) {
    if (blockedSlots.has(blockedSlotKey(day, p))) blockedPeriods.push(p);
    for (const entry of covers.get(keyFor(day, p)) ?? []) {
      if (entry.start < period) return null;
      cluster.set(entry.id, entry);
      clusterEnd = Math.max(clusterEnd, entry.end);
    }
  }

  const entries = [...cluster.values()].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id),
  );
  return { entries, span: clusterEnd - period + 1, blockedPeriods };
}

function colorStyle(color: CourseColor): CSSProperties {
  return {
    '--block-stripe': color.stripe,
    '--block-bg': color.bg,
    '--block-fg': color.fg,
  } as CSSProperties;
}

function TimetableCell({
  day,
  entries,
  blocked,
  blockedPeriods = [],
  rowSpan,
  startPeriod,
  onOpenDetail,
}: {
  day: number;
  entries: TimetableEntry[];
  blocked: boolean;
  blockedPeriods?: number[];
  rowSpan?: number;
  startPeriod?: number;
  onOpenDetail?: (id: string) => void;
}) {
  const hasEntries = entries.length > 0;
  const isConflict = entries.some((entry) => entry.conflict);
  const blockedEntries: BlockedTimetableEntry[] = rowSpan && startPeriod
    ? blockedPeriods.map((period) => ({
      id: `blocked-${day}-${period}`,
      start: period,
      end: period,
      span: 1,
      color: BLOCKED_COLOR,
    }))
    : [];
  const layoutEntries: Array<TimetableEntry | BlockedTimetableEntry> = [
    ...entries,
    ...blockedEntries,
  ];
  const visualItemCount = layoutEntries.length + (blocked && blockedEntries.length === 0 ? 1 : 0);
  const isParallel = Boolean(rowSpan && startPeriod && layoutEntries.length > 1);
  const laneLayout = isParallel ? assignTimetableLanes(layoutEntries) : null;
  const parallelSizing = laneLayout ? getParallelLaneSizing(laneLayout.laneCount) : null;
  const courseMobileLayers = laneLayout && rowSpan && startPeriod
    ? getMobileContainmentLayers(entries, startPeriod, rowSpan)
    : [];
  // “有事”参与桌面端真实时间网格；只有课程本身存在包含关系时，才启用
  // 手机端的包围布局，避免单个占位把普通两节课无谓地拉得很高。
  const hasMobileContainment = courseMobileLayers.some(
    (layer) => layer.depth > 0 || layer.lane > 0,
  );
  const mobileGroups = hasMobileContainment && rowSpan && startPeriod
    ? getMobileContainmentGroups(layoutEntries, startPeriod, rowSpan)
    : [];
  const mobileContainmentMetrics = rowSpan
    ? getMobileContainmentMetrics(mobileGroups, rowSpan)
    : { minHeight: 0, metrics: [] };
  const className = [
    'timetable__cell',
    day === 1 ? 'timetable__cell--first-day' : '',
    hasEntries ? 'timetable__cell--has' : 'timetable__cell--empty',
    blocked ? 'timetable__cell--blocked' : '',
    isConflict ? 'timetable__cell--conflict' : '',
    visualItemCount === 1 && !isConflict ? 'timetable__cell--single' : '',
    rowSpan ? 'timetable__cell--span' : '',
    isParallel ? 'timetable__cell--parallel' : '',
    hasMobileContainment ? 'timetable__cell--containment' : '',
  ].filter(Boolean).join(' ');

  const renderCourseButton = (
    entry: TimetableEntry,
    mobileGroup?: (typeof mobileGroups)[number],
  ) => {
    const lane = laneLayout?.laneById.get(entry.id);
    const reservesWarningSpace = mobileGroup
      ? mobileGroup.depth === Math.max(...mobileGroups.map((group) => group.depth))
        && mobileGroup.start === startPeriod
        && mobileGroup.entryIds[0] === entry.id
      : Boolean(
        isConflict
        && laneLayout
        && lane === laneLayout.laneCount - 1
        && entry.start === startPeriod,
      );
    return (
      <button
        key={entry.id}
        type="button"
        className={[
          'timetable-course',
          entry.conflict ? 'timetable-course--conflict' : '',
          reservesWarningSpace ? 'timetable-course--warning-space' : '',
        ].filter(Boolean).join(' ')}
        style={{
          ...colorStyle(entry.color),
          ...(!mobileGroup && lane !== undefined && startPeriod ? {
            gridColumn: lane + 1,
            gridRow: `${entry.start - startPeriod + 1} / span ${entry.span}`,
          } : {}),
        }}
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
    );
  };

  const renderBlockedButton = (
    entry: BlockedTimetableEntry,
    mobileGroup?: (typeof mobileGroups)[number],
  ) => {
    const lane = laneLayout?.laneById.get(entry.id);
    return (
      <div
        key={entry.id}
        className="timetable-course timetable-placeholder"
        aria-label="自定义占位时间"
        style={{
          ...colorStyle(entry.color),
          ...(!mobileGroup && lane !== undefined && startPeriod ? {
            gridColumn: lane + 1,
            gridRow: `${entry.start - startPeriod + 1} / span ${entry.span}`,
          } : {}),
        }}
      >
        <span>有事</span>
      </div>
    );
  };

  return (
    <td className={className} rowSpan={rowSpan}>
      {isConflict ? <WarningIcon className="timetable__warning-icon" /> : null}
      <div
        className="timetable__courses timetable__courses--desktop"
        style={laneLayout ? {
          '--parallel-columns': laneLayout.laneCount,
          '--parallel-rows': rowSpan,
          '--parallel-column-gap': `${parallelSizing?.columnGap ?? 6}px`,
          '--parallel-card-padding-start': `${parallelSizing?.paddingInlineStart ?? 9}px`,
          '--parallel-card-padding-end': `${parallelSizing?.paddingInlineEnd ?? 7}px`,
        } as CSSProperties : undefined}
      >
        {blocked && blockedEntries.length === 0 ? (
          <div
            className="timetable-course timetable-placeholder"
            aria-label="自定义占位时间"
          >
            <span>有事</span>
          </div>
        ) : null}
        {entries.map((entry) => renderCourseButton(entry))}
        {blockedEntries.map((entry) => renderBlockedButton(entry))}
      </div>
      {hasMobileContainment ? (
        <>
          <span
            className="timetable__mobile-containment-sizer"
            aria-hidden="true"
            style={{ '--mobile-containment-min-height': `${mobileContainmentMetrics.minHeight}px` } as CSSProperties}
          />
          <div className="timetable__mobile-containment">
            {mobileGroups.map((group) => {
              const groupEntries = group.entryIds
                .map((id) => layoutEntries.find((entry) => entry.id === id))
                .filter((entry): entry is TimetableEntry | BlockedTimetableEntry => Boolean(entry));
              const color = groupEntries[0]?.color;
              const metric = mobileContainmentMetrics.metrics.find((candidate) => candidate.key === group.key);
              return (
                <div
                  key={group.key}
                  className={`timetable__mobile-range${group.rangeCount > 1 ? ' timetable__mobile-range--siblings' : ''}`}
                  style={{
                    '--mobile-range-top': `${group.topPercent}%`,
                    '--mobile-range-height': `${group.heightPercent}%`,
                    '--mobile-range-left': `${group.leftInset}px`,
                    '--mobile-range-right': `${group.rightInset}px`,
                    '--mobile-range-content-top': `${metric?.contentOffset ?? 0}px`,
                    '--mobile-range-content-height': `${metric?.contentHeight ?? 112}px`,
                    '--mobile-range-stripe': color?.stripe,
                    '--mobile-range-bg': color?.bg,
                    '--mobile-range-depth': group.depth + 1,
                  } as CSSProperties}
                >
                  <span className="timetable__mobile-range-background" aria-hidden="true" />
                  <div className="timetable__mobile-range-content">
                    {groupEntries.map((entry) => (
                      'groupKey' in entry
                        ? renderCourseButton(entry, group)
                        : renderBlockedButton(entry, group)
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
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
      <span className="timetable__day-label-row">
        <span className="timetable__day-title">{DAY_LABELS[day]}</span>
        {info?.holiday ? <span className="timetable__day-badge">休</span> : null}
        {info?.makeup ? <span className="timetable__day-badge timetable__day-badge--makeup">{info.makeup.label}</span> : null}
      </span>
      {info ? <span className="timetable__day-date">{formatShortDate(info.iso)}</span> : null}
    </th>
  );
}

function TimetableView({
  weekSelection,
  groups,
  exportMode = false,
  themeMode,
  onOpenDetail,
  blockedSlots,
}: TimetableViewProps) {
  const colorTheme = exportMode ? 'light' : themeMode;
  const blockedSlotSet = useMemo(() => new Set(blockedSlots), [blockedSlots]);
  const entries = useMemo(
    () => buildEntries(groups, weekSelection, colorTheme, blockedSlotSet),
    [blockedSlotSet, groups, weekSelection, colorTheme],
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
                  <span className="timetable__band-label">
                    {[...BAND_STARTS[period].label].map((character) => (
                      <span key={character}>{character}</span>
                    ))}
                  </span>
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
                const rowSpanBlock = getRowSpanEntries(
                  period,
                  covering,
                  starting,
                  covers,
                  blockedSlotSet,
                );
                const blocked = blockedSlotSet.has(cellKey);

                if (rowSpanBlock) {
                  for (let p = period + 1; p < period + rowSpanBlock.span; p += 1) {
                    skipped.add(keyFor(day, p));
                  }
                  return (
                    <TimetableCell
                      key={day}
                      day={day}
                      entries={rowSpanBlock.entries}
                      blocked={false}
                      blockedPeriods={rowSpanBlock.blockedPeriods}
                      rowSpan={rowSpanBlock.span}
                      startPeriod={period}
                      onOpenDetail={onOpenDetail}
                    />
                  );
                }

                return (
                  <TimetableCell
                    key={day}
                    day={day}
                    entries={starting}
                    blocked={blocked}
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
  blockedSlots,
  onOpenCustomization,
}: Props) {
  const toggleLabel = themeMode === 'dark' ? '切换到亮色模式' : '切换到暗色模式';
  const weekOptions = useMemo(() => getWeekOptions(), []);
  const sliderWeek = typeof weekSelection === 'number' ? weekSelection : 1;
  const [contributorsOpen, setContributorsOpen] = useState(false);
  const contributorsTriggerRef = useRef<HTMLButtonElement>(null);

  const closeContributors = () => {
    setContributorsOpen(false);
    window.requestAnimationFrame(() => contributorsTriggerRef.current?.focus());
  };

  return (
    <div className="panel-inner course-table-wrap" data-tour="timetable-area">
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
        <div className="course-table__term-date">
          <span className="course-table__term-name">{TERM_CALENDAR.termName}</span>
          <span className="course-table__date-range">{formatDateRange(weekSelection)}</span>
        </div>
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
            className="course-table__customize-button"
            onClick={onOpenCustomization}
            aria-label="自定义"
            data-tour="customization"
            icon={<GearIcon className="course-table__button-icon" />}
          >
            <span className="course-table__customize-label">自定义</span>
          </Button>
          <Button
            className="course-table__export-button"
            type="primary"
            onClick={onExport}
            loading={exporting}
            aria-label="导出图片"
            data-tour="export"
            icon={<DownloadIcon className="course-table__button-icon" />}
          >
            <span className="course-table__export-label">导出图片</span>
          </Button>
        </div>
      </div>

      <div className="course-table__scroll" data-tour="timetable">
        <TimetableView
          weekSelection={weekSelection}
          groups={groups}
          themeMode={themeMode}
          blockedSlots={blockedSlots}
          onOpenDetail={onOpenDetail}
        />
      </div>

      <div className="course-table__project-footer no-print">
        <span>点击访问</span>
        <a
          className="course-table__project-footer-link"
          href={PROJECT_LINKS.repository}
          target="_blank"
          rel="noreferrer"
        >
          GitHub 页面
        </a>
        <span>或点击查看</span>
        <button
          ref={contributorsTriggerRef}
          className="course-table__project-footer-link course-table__contributors-button"
          type="button"
          onClick={() => setContributorsOpen(true)}
        >
          贡献列表
        </button>
      </div>

      <div className="timetable-export-stage" ref={exportRef}>
        <TimetableView
          weekSelection={weekSelection}
          groups={groups}
          exportMode
          themeMode="light"
          blockedSlots={blockedSlots}
        />
      </div>

      <BottomModal
        className="contributors-modal"
        open={contributorsOpen}
        title="贡献详情"
        onClose={closeContributors}
        width={680}
      >
        <ContributorList variant="detail" />
      </BottomModal>
    </div>
  );
}
