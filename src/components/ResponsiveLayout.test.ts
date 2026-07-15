import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function ruleBodies(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...styles.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((match) => match[1])
    .join('\n');
}

describe('responsive modal and course-list layout', () => {
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
});
