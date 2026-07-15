import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CourseTable.tsx', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const gridSource = readFileSync(new URL('../constants/grid.ts', import.meta.url), 'utf8');

describe('CourseTable precise conflict marking', () => {
  it('keeps periods for layout but compares minute intervals for conflicts', () => {
    expect(source).toContain('timeIntervals: MinuteInterval[]');
    expect(source).toContain('minuteIntervalsOverlap');
    expect(source).not.toContain('function periodOverlaps');
  });

  it('shows exact clock times instead of the approximate grid period', () => {
    expect(source).toContain("`${slot.startTime}~${slot.endTime}`");
  });

  it('keeps all-weeks weekday labels centered in the date-height header', () => {
    expect(source).toContain("info ? '' : 'timetable__day-head--without-date'");
    expect(stylesheet).toMatch(/\.timetable__day-head\s*\{[^}]*height:\s*46px;/s);
    expect(stylesheet).toMatch(
      /\.timetable__day-head--without-date\s*\{[^}]*vertical-align:\s*middle;/s,
    );
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
    expect(source).toContain('课程信息最后更新于 {formatCatalogUpdatedDate(catalogGeneratedAt)}. 访问');
    expect(source).toMatch(/>\s*GitHub\s*<\/a>/);
    expect(source).toContain('或查看');
    expect(source).toContain('onClick={() => setContributorsOpen(true)}');
    expect(source).toContain('贡献列表');
    expect(source).toContain('title="贡献详情"');
  });
});
