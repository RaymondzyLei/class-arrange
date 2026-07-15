import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CourseTable.tsx', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

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
});
