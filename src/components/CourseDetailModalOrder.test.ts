import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./CourseDetailModal.tsx', import.meta.url),
  'utf8',
);

function expectReferenceBooksBeforeMaterials(fragment: string): void {
  const referenceBooks = fragment.indexOf('course-material-group__label">参考书');
  const materials = fragment.indexOf('course-material-group__label">教材');
  const handouts = fragment.indexOf('course-material-group__label">讲义');
  expect(referenceBooks).toBeGreaterThanOrEqual(0);
  expect(materials).toBeGreaterThanOrEqual(0);
  expect(handouts).toBeGreaterThanOrEqual(0);
  expect(referenceBooks).toBeLessThan(materials);
  expect(materials).toBeLessThan(handouts);
}

describe('CourseDetailModal information order', () => {
  it('shares one material table across desktop and mobile in the requested order', () => {
    const start = source.indexOf('className="course-material-groups"');
    const end = source.indexOf('</section>', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expectReferenceBooksBeforeMaterials(source.slice(start, end));
    expect(source.match(/className="course-material-groups"/g)).toHaveLength(1);
  });

  it('uses the exact-time-aware formatter in the schedule detail table', () => {
    expect(source).toContain('formatScheduleSlotTime(s)');
    expect(source).toContain("title: '时间 / 节次'");
  });
});
