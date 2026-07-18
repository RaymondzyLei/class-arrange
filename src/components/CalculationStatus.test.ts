import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CalculationStatus from './CalculationStatus';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const arrangementCalculationHookSource = readFileSync(
  new URL('../hooks/useArrangementCalculation.ts', import.meta.url),
  'utf8',
);
const arrangementPanelSource = readFileSync(new URL('./ArrangementPanel.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const tokensSource = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

function renderStatus(
  phase: 'dirty' | 'ready',
  hasSnapshot: boolean,
  compact = false,
) {
  return renderToStaticMarkup(createElement(CalculationStatus, {
    phase,
    mode: 'manual',
    hasSnapshot,
    actionLabel: '重新计算',
    error: null,
    onCalculate: vi.fn(),
    compact,
  }));
}

describe('CalculationStatus', () => {
  it('uses a separate Worker client for loading every conflict-free result', () => {
    expect(arrangementCalculationHookSource).toContain('allConflictFreeClientRef');
    expect(arrangementCalculationHookSource).toMatch(
      /calculateResults\(\s*draft\.groups,\s*draft\.settings,\s*'recommended',\s*draft\.favorites,/,
    );
    expect(arrangementCalculationHookSource).toContain("'all-conflict-free'");
    expect(arrangementCalculationHookSource).toContain('committed.favorites');
    expect(arrangementCalculationHookSource).toContain('loadAllConflictFree');
  });

  it('switches arrangement views without overwriting the recommended selection', () => {
    expect(appSource).toContain("useState<'recommended' | 'conflict-free'>('recommended')");
    expect(appSource).toContain('recommendedArrangementSelection');
    expect(appSource).toContain('conflictFreeArrangementSelection');
    expect(appSource).toContain('calculation.committed?.conflictFreePreview');
    expect(appSource).toMatch(
      /const showAllConflictFreeArrangements = \(\) => \{[\s\S]*setArrangementView\('conflict-free'\);[\s\S]*calculation\.loadAllConflictFree\(\);[\s\S]*\};/,
    );
    expect(appSource).toContain('onShowConflictFree={showAllConflictFreeArrangements}');
    expect(appSource).not.toContain('onLoadAllConflictFree=');
    expect(arrangementPanelSource).not.toContain('全部展示');
    expect(arrangementPanelSource).not.toContain('totalConflictFreeCount > 100');
  });

  it('always renders the arrangement panel with a compact header status', () => {
    expect(appSource).toMatch(
      /const calculationStatus = \([\s\S]*<CalculationStatus[\s\S]*compact=\{true\}[\s\S]*\);/,
    );
    expect(appSource).toMatch(/<ArrangementPanel[\s\S]*status=\{calculationStatus\}/);
    expect(appSource).toContain(
      'totalConflictFreeCount={calculation.committed?.totalConflictFreeCount ?? 0}',
    );
    expect(appSource).not.toContain('{calculation.committed ? (');
    expect(appSource).not.toContain(') : calculationStatus}');
    expect(arrangementPanelSource).not.toContain('panel-inner arrangement-panel');
  });

  it('shows only the changed-input message for a dirty timetable', () => {
    const html = renderStatus('dirty', true);

    expect(html).toContain('课程或偏好已变更。');
    expect(html).toContain('ant-btn-sm');
    expect(html).not.toContain('待重新计算');
    expect(html).not.toContain('当前仍显示上次计算的课表');
  });

  it('shows only the latest-success message for a ready timetable', () => {
    const html = renderStatus('ready', true);

    expect(html).toContain('当前课表来自最近一次成功计算。');
    expect(html).not.toContain('排课结果已就绪');
    expect(html).toContain('calculation-status__message');
  });

  it('uses a separate text viewport for compact status without moving its dot or action', () => {
    const html = renderStatus('dirty', true, true);

    expect(html).toContain('calculation-status--compact');
    expect(html).toContain('calculation-status__message-content');
    expect(html).toContain('title="课程或偏好已变更。"');
  });

  it('keeps every calculation state row at the same height', () => {
    const statusRule = stylesSource.match(/\n\.calculation-status\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(statusRule).toContain('min-height: 38px');
    expect(statusRule).toContain('box-sizing: border-box');
    expect(statusRule).toContain('background: transparent');
  });

  it('only animates a measured compact text viewport', () => {
    expect(stylesSource).toContain('.calculation-status--compact');
    expect(stylesSource).toContain('.calculation-status__message--scrolling');
    expect(stylesSource).toContain('@keyframes calculation-status-marquee');
    expect(stylesSource).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps the compact header status at action-chip height without vertical padding', () => {
    const compactRule = stylesSource.match(
      /\.calculation-status\.calculation-status--compact\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';

    expect(compactRule).toContain('min-height: var(--action-chip-height)');
    expect(compactRule).toContain('padding: 0');
    expect(compactRule).toContain('border: 0');
  });

  it('restarts overflowing text from the beginning instead of reversing it', () => {
    expect(stylesSource).toContain('linear 1.2s infinite');
    expect(stylesSource).not.toContain('infinite alternate');
  });

  it('shares the contributor additions color with the ready status dot', () => {
    const readyDotRule = stylesSource.match(
      /\.calculation-status--ready \.calculation-status__dot\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';

    expect(tokensSource).toContain('--contributor-additions: #16a34a');
    expect(tokensSource).toContain('--contributor-additions: #4ade80');
    expect(readyDotRule).toContain('background: var(--contributor-additions)');
  });

  it('applies the newly ranked first arrangement before the browser paints', () => {
    expect(appSource).toContain('useLayoutEffect');
    expect(appSource).toContain('activeArrangementSelection.inputKey === committedArrangementInputKey');
    expect(appSource).toContain('setRecommendedArrangementSelection((current) => ({');
    expect(arrangementPanelSource).toContain('key={index}');
    const cardRule = stylesSource.match(/\.arrangement-card\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(cardRule).not.toContain('transition:');
  });
});
