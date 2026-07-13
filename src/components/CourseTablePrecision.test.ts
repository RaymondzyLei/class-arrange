import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CourseTable.tsx', import.meta.url), 'utf8');

describe('CourseTable precise conflict marking', () => {
  it('keeps periods for layout but compares minute intervals for conflicts', () => {
    expect(source).toContain('timeIntervals: MinuteInterval[]');
    expect(source).toContain('minuteIntervalsOverlap');
    expect(source).not.toContain('function periodOverlaps');
  });
});
