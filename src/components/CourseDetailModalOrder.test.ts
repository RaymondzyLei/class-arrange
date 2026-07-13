import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./CourseDetailModal.tsx', import.meta.url),
  'utf8',
);

function expectReferenceBooksBeforeMaterials(fragment: string): void {
  const referenceBooks = fragment.indexOf('参考书');
  const materials = fragment.indexOf('教材');
  expect(referenceBooks).toBeGreaterThanOrEqual(0);
  expect(materials).toBeGreaterThanOrEqual(0);
  expect(referenceBooks).toBeLessThan(materials);
}

describe('CourseDetailModal information order', () => {
  it('places reference books before textbook and handout content on desktop', () => {
    const start = source.indexOf('<Descriptions size="small"');
    const end = source.indexOf('</Descriptions>', start);
    expectReferenceBooksBeforeMaterials(source.slice(start, end));
  });

  it('places reference books before textbook and handout content on mobile', () => {
    const start = source.indexOf('course-detail-summary-card');
    const end = source.indexOf('</section>', start);
    expectReferenceBooksBeforeMaterials(source.slice(start, end));
  });

  it('uses the exact-time-aware formatter in the schedule detail table', () => {
    expect(source).toContain('formatScheduleSlotTime(s)');
    expect(source).toContain("title: '时间 / 节次'");
  });
});
