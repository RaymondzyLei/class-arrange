import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function ruleBodies(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...styles.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((match) => match[1])
    .join('\n');
}

function mobileSelectPopupRules(): string {
  return styles.match(
    /\.curriculum-select-dropdown\s*,\s*\.plan-select-dropdown\s*\{([^}]*)\}/,
  )?.[1] ?? '';
}

describe('responsive modal and course-list layout', () => {
  it('keeps focusable mobile form controls at Safari-safe text size', () => {
    expect(styles).toMatch(
      /@media \(max-width: 640px\)\s*\{\s*:where\(input:not\(\[type='checkbox'\], \[type='radio'\], \[type='range'\], \[type='color'\], \[type='button'\], \[type='submit'\], \[type='reset'\]\), textarea, select\)\s*\{[^}]*font-size:\s*16px !important;/s,
    );
    expect(styles).not.toContain('maximum-scale');
    expect(styles).not.toContain('user-scalable=no');
  });

  it('keeps the curriculum popup inside the mobile viewport without transform positioning', () => {
    const curriculumPopupRules = mobileSelectPopupRules();

    expect(curriculumPopupRules).toContain('width: calc(100% - 24px) !important');
    expect(curriculumPopupRules).toContain('max-width: calc(100% - 24px)');
    expect(curriculumPopupRules).toContain('inset-inline-start: auto !important');
    expect(curriculumPopupRules).toContain('inset-inline-end: 12px !important');
    expect(curriculumPopupRules).not.toMatch(/\bleft\s*:/);
    expect(curriculumPopupRules).not.toMatch(/\btransform\s*:/);
  });

  it('uses the available mobile viewport width for the plan popup without physical positioning', () => {
    const planPopupRules = mobileSelectPopupRules();

    expect(planPopupRules).toContain('width: calc(100% - 24px) !important');
    expect(planPopupRules).toContain('min-width: 0 !important');
    expect(planPopupRules).toContain('max-width: calc(100% - 24px)');
    expect(planPopupRules).toContain('inset-inline-start: auto !important');
    expect(planPopupRules).toContain('inset-inline-end: 12px !important');
    expect(planPopupRules).not.toMatch(/\bleft\s*:/);
    expect(planPopupRules).not.toMatch(/\btransform\s*:/);
  });

  it('lets customization inherit the mobile size of course-detail modals', () => {
    const customizationModalRules = ruleBodies('.customization-modal');
    const customizationPanelRules = ruleBodies('.customization-modal .bottom-modal__panel');

    expect(customizationModalRules).not.toContain('--bottom-modal-mobile-inset');
    expect(customizationPanelRules).not.toContain('width: 100% !important');
    expect(customizationPanelRules).not.toContain('border-radius: 16px');

    expect(styles).toMatch(
      /\.bottom-modal\s*\{[^}]*--bottom-modal-mobile-inset:\s*clamp\(18px, 6vw, 28px\)/s,
    );
    expect(styles).toMatch(/\.bottom-modal__panel\s*\{[^}]*border-radius:\s*14px/s);
  });

  it('gives the mobile course list a bounded viewport for virtualization', () => {
    expect(styles).toMatch(
      /@media \(max-width: 900px\)\s*\{\s*\.course-pool__list\s*\{[^}]*flex:\s*0 0 auto;[^}]*height:\s*clamp\(360px, 68dvh, 640px\);[^}]*\}\s*\}/s,
    );
  });

  it('keeps the desktop timetable frame on the same bottom edge as the course list', () => {
    expect(ruleBodies('.table-panel')).not.toMatch(/margin-bottom:\s*-\d/);
  });
});
