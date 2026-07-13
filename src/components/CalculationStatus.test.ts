import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CalculationStatus from './CalculationStatus';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const arrangementPanelSource = readFileSync(new URL('./ArrangementPanel.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function renderStatus(
  phase: 'dirty' | 'ready',
  hasSnapshot: boolean,
) {
  return renderToStaticMarkup(createElement(CalculationStatus, {
    phase,
    mode: 'manual',
    hasSnapshot,
    actionLabel: '重新计算',
    error: null,
    onCalculate: vi.fn(),
  }));
}

describe('CalculationStatus', () => {
  it('shares one panel with the arrangement list', () => {
    expect(appSource).toMatch(
      /className="panel-inner calculation-results no-print"[\s\S]*<CalculationStatus[\s\S]*<ArrangementPanel/,
    );
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

  it('keeps every calculation state row at the same height', () => {
    const statusRule = stylesSource.match(/\n\.calculation-status\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(statusRule).toContain('min-height: 38px');
    expect(statusRule).toContain('box-sizing: border-box');
  });

  it('applies the newly ranked first arrangement before the browser paints', () => {
    expect(appSource).toContain('useLayoutEffect');
    expect(appSource).toContain('arrangementSelection.inputKey === committedArrangementInputKey');
    expect(appSource).toContain('setArrangementSelection((current) => ({');
    expect(arrangementPanelSource).toContain('key={index}');
    const cardRule = stylesSource.match(/\.arrangement-card\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(cardRule).not.toContain('transition:');
  });
});
