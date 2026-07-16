import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Arrangement } from '@/types';
import ArrangementPanel from './ArrangementPanel';

const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return styles.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'))?.[1] ?? '';
}

describe('ArrangementPanel viewport height', () => {
  it.each([
    '.arrangement-panel__list--scroll',
    '.arrangement-panel__list--mobile-scroll',
  ])('clips %s after one and a half card rows', (selector) => {
    const rule = ruleBody(selector);

    expect(rule).toContain('var(--arrangement-card-height) * 1.5');
    expect(rule).toContain('var(--arrangement-list-gap) * 1');
    expect(rule).toContain('var(--arrangement-ring-space) * 2');
    expect(rule).not.toContain('var(--arrangement-card-height) * 2.5');
  });

  it('places a supplied compact status beside the title instead of a plan count', () => {
    const arrangements: Arrangement[] = [
      {
        id: 'first', groups: [], conflictCount: 0, courseCount: 3, totalCredits: 6, totalHours: 96,
      },
      {
        id: 'second', groups: [], conflictCount: 1, courseCount: 3, totalCredits: 6, totalHours: 96,
      },
    ];
    const html = renderToStaticMarkup(createElement(ArrangementPanel, {
      arrangements,
      selectedId: 'first',
      onSelect: () => undefined,
      status: createElement('span', { className: 'test-compact-status' }, '当前课表来自最近一次成功计算。'),
    }));

    expect(html).toContain('排课方案');
    expect(html).toContain('test-compact-status');
    expect(html).not.toContain('共 2 种方案');
  });

  it('does not keep a legacy top divider above the embedded header status', () => {
    const resultPanelRule = styles.match(
      /\.calculation-results \.arrangement-panel\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';

    expect(resultPanelRule).not.toContain('border-top');
  });
});
