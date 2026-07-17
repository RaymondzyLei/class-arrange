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
  const arrangements: Arrangement[] = [
    {
      id: 'first', groups: [], conflictCount: 0, courseCount: 3, totalCredits: 6, totalHours: 96,
    },
    {
      id: 'second', groups: [], conflictCount: 1, courseCount: 3, totalCredits: 6, totalHours: 96,
    },
  ];
  const baseProps = {
    arrangements,
    selectedId: 'first',
    onSelect: () => undefined,
    status: createElement('span', { className: 'test-compact-status' }, '当前课表来自最近一次成功计算。'),
    totalConflictFreeCount: 2,
    allConflictFreePhase: 'idle' as const,
    allConflictFreeError: null,
    onShowConflictFree: () => undefined,
    onShowRecommended: () => undefined,
    onLoadAllConflictFree: () => undefined,
  };

  it('offers a standalone conflict-free action in recommended mode', () => {
    const html = renderToStaticMarkup(createElement(ArrangementPanel, {
      ...baseProps,
      mode: 'recommended',
    }));

    expect(html).toContain('展示所有不冲突方案');
    expect(html).not.toContain('返回推荐方案');
  });

  it('shows the exact conflict-free count without load-all at or below 100', () => {
    const html = renderToStaticMarkup(createElement(ArrangementPanel, {
      ...baseProps,
      mode: 'conflict-free',
      totalConflictFreeCount: 100,
    }));

    expect(html).toContain('返回推荐方案');
    expect(html).toContain('共 100 种不冲突方案');
    expect(html).not.toContain('全部展示');
  });

  it('makes only the load-all text actionable above the 100-result preview cap', () => {
    const html = renderToStaticMarkup(createElement(ArrangementPanel, {
      ...baseProps,
      mode: 'conflict-free',
      totalConflictFreeCount: 123,
    }));

    expect(html).toContain('共 123 种不冲突方案，');
    expect(html).toMatch(/<button[^>]*class="arrangement-panel__load-all"[^>]*>全部展示<\/button>/);
  });

  it('keeps the preview visible while loading all and explains empty results', () => {
    const loadingHtml = renderToStaticMarkup(createElement(ArrangementPanel, {
      ...baseProps,
      mode: 'conflict-free',
      totalConflictFreeCount: 123,
      allConflictFreePhase: 'loading',
    }));
    const emptyHtml = renderToStaticMarkup(createElement(ArrangementPanel, {
      ...baseProps,
      arrangements: [],
      selectedId: null,
      mode: 'conflict-free',
      totalConflictFreeCount: 0,
    }));

    expect(loadingHtml).toContain('正在加载全部方案');
    expect(loadingHtml).toContain('排课方案 0');
    expect(emptyHtml).toContain('没有不冲突的排课方案');
  });

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
    const html = renderToStaticMarkup(createElement(ArrangementPanel, {
      ...baseProps,
      mode: 'recommended',
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
