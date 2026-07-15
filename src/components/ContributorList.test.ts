import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('ContributorList', () => {
  it('uses a clean solid color for avatar placeholders', () => {
    const avatarRule = stylesSource.match(/\.contributor-list__avatar\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(avatarRule).toContain('background: var(--accent-soft)');
    expect(avatarRule).not.toContain('linear-gradient');
    expect(avatarRule).not.toContain('box-shadow');
  });

  it('keeps contributor card backgrounds unchanged on hover', () => {
    const hoverRule = stylesSource.match(/\.contributor-list__item:hover\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(hoverRule).toContain('border-color');
    expect(hoverRule).not.toContain('background:');
  });
});
