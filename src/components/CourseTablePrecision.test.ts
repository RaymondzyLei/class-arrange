import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CourseTable.tsx', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const gridSource = readFileSync(new URL('../constants/grid.ts', import.meta.url), 'utf8');
const legacyGridSource = readFileSync(new URL('../utils/grid.ts', import.meta.url), 'utf8');

describe('CourseTable precise conflict marking', () => {
  it('labels the customization entry as settings', () => {
    expect(source).toContain('aria-label="设置"');
    expect(source).toContain('<span className="course-table__customize-label">设置</span>');
  });

  it('keeps periods for layout but compares minute intervals for conflicts', () => {
    expect(source).toContain('timeIntervals: MinuteInterval[]');
    expect(source).toContain('minuteIntervalsOverlap');
    expect(source).not.toContain('function periodOverlaps');
  });

  it('shows exact clock times instead of the approximate grid period', () => {
    expect(source).toContain("`${slot.startTime}~${slot.endTime}`");
  });

  it('builds one timetable entry from identical time-location fragments without expanding gaps', () => {
    expect(source).toContain('coalesceScheduleSlots(group.schedule)');
    expect(source).toContain('slot.activeWeeks.includes(date.effectiveWeek)');
    expect(source).toContain('formatActiveWeeks(slot.activeWeeks)');
    expect(source).not.toContain('isWeekInArray(slot.weeks, date.effectiveWeek)');

    expect(legacyGridSource).toContain('coalesceScheduleSlots(g.schedule)');
    expect(legacyGridSource).toContain('slot.activeWeeks.includes(week)');
  });

  it('keeps all-weeks weekday labels centered in the date-height header', () => {
    expect(source).toContain("info ? '' : 'timetable__day-head--without-date'");
    expect(stylesheet).toMatch(/\.timetable__day-head\s*\{[^}]*height:\s*46px;/s);
    expect(stylesheet).toMatch(
      /\.timetable__day-head--without-date\s*\{[^}]*vertical-align:\s*middle;/s,
    );
  });

  it('keeps one consolidated 51.5px cell rule for the displayed timetable', () => {
    const timetableCellRules = [
      ...stylesheet.matchAll(/(?:^|\n)\.timetable__cell\s*\{([^}]*)\}/g),
    ];

    expect(timetableCellRules).toHaveLength(1);
    expect(timetableCellRules[0]?.[1]).toMatch(/height:\s*51\.5px;/);
    expect(timetableCellRules[0]?.[1]).toContain('padding: 3px 4px 3px 3px;');
    expect(timetableCellRules[0]?.[1]).toContain('vertical-align: top;');
    expect(timetableCellRules[0]?.[1]).toContain(
      'background: var(--timetable-cell-bg, color-mix(in srgb, var(--panel-bg) 96%, #fff));',
    );
    expect(timetableCellRules[0]?.[1]).toContain('position: relative;');
  });

  it('keeps one 69px cell-height override for exported timetables', () => {
    const exportCellRules = [
      ...stylesheet.matchAll(
        /(?:^|\n)\.timetable-shell--export \.timetable__cell\s*\{([^}]*)\}/g,
      ),
    ];

    expect(exportCellRules).toHaveLength(1);
    expect(exportCellRules[0]?.[1]).toMatch(/height:\s*69px;/);
  });

  it('renders headers and cells from the selected week weekdays without a fixed 20-week constant', () => {
    expect(source).toContain('getVisibleWeekdays');
    expect(source.match(/visibleDays\.map/g)).toHaveLength(2);
    expect(gridSource).not.toContain('export const WEEKS');
  });

  it('renders the term date range directly from the calendar without the selected week', () => {
    expect(source).toContain('{formatTermDateRange(calendar)}');
  });

  it('shows the catalog-generated update date while preserving both project links', () => {
    expect(source).toContain('catalogGeneratedAt: string');
    expect(source).toContain('className="course-table__project-footer-update"');
    expect(source).toContain('课程信息最后更新于 {formatCatalogUpdatedDate(catalogGeneratedAt)}.');
    expect(source).toContain('className="course-table__project-footer-links"');
    expect(source).toMatch(/>\s*GitHub\s*<\/a>/);
    expect(source).toContain('或查看');
    expect(source).toContain('onClick={() => setContributorsOpen(true)}');
    expect(source).toContain('贡献列表');
    expect(source).toContain('title="贡献详情"');
  });

  it('centers each wrapped project-footer line independently', () => {
    expect(source).toContain('className="course-table__project-footer-content"');
    expect(stylesheet).toMatch(
      /\.course-table__project-footer\s*\{[^}]*justify-content:\s*center;[^}]*height:\s*auto;/s,
    );
    expect(stylesheet).toMatch(
      /\.course-table__project-footer-content\s*\{[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;[^}]*justify-content:\s*center;[^}]*flex-wrap:\s*wrap;[^}]*text-align:\s*center;/s,
    );
    expect(stylesheet).toMatch(
      /\.course-table__project-footer-update,\s*\.course-table__project-footer-links\s*\{[^}]*white-space:\s*nowrap;/s,
    );
  });

  it('adds the timetable-to-footer gap only when the footer wraps', () => {
    expect(stylesheet).toMatch(
      /\.course-table__project-footer\s*\{[^}]*margin-top:\s*0;/s,
    );
    expect(stylesheet).toMatch(
      /\.course-table__project-footer--wrapped\s*\{[^}]*margin-top:\s*4px;/s,
    );
    expect(source).toContain('new ResizeObserver(updateFooterWrapState)');
    expect(source).toContain('links.offsetTop > update.offsetTop');
    expect(source).toContain("footerWrapped ? ' course-table__project-footer--wrapped' : ''");
  });
});
