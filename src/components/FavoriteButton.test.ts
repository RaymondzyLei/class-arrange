import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from './FavoriteButton';

const tokensSource = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function renderButton(active: boolean) {
  return renderToStaticMarkup(createElement(FavoriteButton, {
    active,
    label: '收藏这个方案',
    onToggle: vi.fn(),
  }));
}

describe('FavoriteButton', () => {
  it('server-renders an accessible inactive star action', () => {
    const html = renderButton(false);

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="收藏这个方案"');
    expect(html).toContain('title="收藏这个方案"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('<svg');
    expect(html).not.toContain('favorite-button--active');
  });

  it('server-renders an active filled star action', () => {
    const html = renderButton(true);

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="收藏这个方案"');
    expect(html).toContain('title="收藏这个方案"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('<svg');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('favorite-button--active');
  });

  it('defines the favorite color in both themes and applies it when active', () => {
    expect(tokensSource).toContain('--favorite: #f2b400');
    expect(tokensSource).toContain('--favorite: #e9b85b');
    expect(stylesSource).toMatch(
      /\.favorite-button--active\s*\{\s*color:\s*var\(--favorite\);\s*\}/,
    );
  });

  it('keeps the selected star yellow with a yellow-tinted background on hover', () => {
    const activeHover = stylesSource.match(
      /\.favorite-button--active:hover\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';

    expect(activeHover).toContain('color: var(--favorite)');
    expect(activeHover).toContain('background: color-mix(in srgb, var(--favorite)');
    expect(activeHover).not.toContain('var(--accent)');
  });

  it('uses the yellow favorite palette when an inactive star is hovered', () => {
    const hover = stylesSource.match(
      /\.favorite-button:hover\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';

    expect(hover).toContain('color: var(--favorite)');
    expect(hover).toContain('background: color-mix(in srgb, var(--favorite)');
    expect(hover).not.toContain('var(--accent)');
  });

  it('reveals plan favorite and delete actions only for selected or hovered options', () => {
    const favoriteRule = stylesSource.match(
      /\.plan-option__favorite\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';

    expect(favoriteRule).toContain('opacity: 0');
    for (const selector of [
      '.plan-option--active .plan-option__favorite',
      '.plan-select-dropdown .ant-select-item-option-active .plan-option__favorite',
      '.plan-select-dropdown .ant-select-item-option:hover .plan-option__favorite',
      '.plan-option__favorite:focus-visible',
    ]) {
      expect(stylesSource).toContain(selector);
    }
  });
});
