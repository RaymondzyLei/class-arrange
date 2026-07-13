import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CalculationStatus from './CalculationStatus';

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
  it('shows only the changed-input message for a dirty timetable', () => {
    const html = renderStatus('dirty', true);

    expect(html).toContain('课程或偏好已变更。');
    expect(html).not.toContain('待重新计算');
    expect(html).not.toContain('当前仍显示上次计算的课表');
  });

  it('shows only the latest-success message for a ready timetable', () => {
    const html = renderStatus('ready', true);

    expect(html).toContain('当前课表来自最近一次成功计算。');
    expect(html).not.toContain('排课结果已就绪');
    expect(html).toContain('calculation-status__message');
  });
});
