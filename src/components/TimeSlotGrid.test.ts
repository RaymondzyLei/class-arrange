// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimeSlotGrid, { type TimeSlotCellState } from './TimeSlotGrid';

interface MountedRoot {
  host: HTMLDivElement;
  root: Root;
}

const mountedRoots: MountedRoot[] = [];
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
let frameCallbacks: FrameRequestCallback[] = [];

async function mountGrid(onPaint: ReturnType<typeof vi.fn>): Promise<void> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push({ host, root });
  await act(async () => {
    root.render(createElement(TimeSlotGrid, {
      ariaLabel: '测试时间表格',
      getState: (): TimeSlotCellState => 'empty',
      nextState: (): TimeSlotCellState => 'blocked',
      onPaint,
      stateLabels: {
        empty: '未选择',
        blocked: '已选择',
        hard: '强冲突',
      },
    }));
  });
}

function cell(key: string): HTMLButtonElement {
  const target = document.querySelector<HTMLButtonElement>(`[data-slot-key="${key}"]`);
  if (!target) throw new Error(`Missing grid cell ${key}`);
  return target;
}

function mousePointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointercancel',
  pointerId = 1,
  buttons = type === 'pointercancel' ? 0 : 1,
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    buttons,
  });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  frameCallbacks = [];
  window.requestAnimationFrame = (callback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  };
  window.cancelAnimationFrame = vi.fn();
});

afterEach(async () => {
  await act(async () => {
    for (const { root } of mountedRoots.splice(0).reverse()) root.unmount();
    await Promise.resolve();
  });
  document.body.replaceChildren();
  if (originalRequestAnimationFrame) window.requestAnimationFrame = originalRequestAnimationFrame;
  else delete (window as Partial<Window>).requestAnimationFrame;
  if (originalCancelAnimationFrame) window.cancelAnimationFrame = originalCancelAnimationFrame;
  else delete (window as Partial<Window>).cancelAnimationFrame;
});

describe('TimeSlotGrid paint batching', () => {
  it('commits all mouse-painted cells once per animation frame', async () => {
    const onPaint = vi.fn();
    await mountGrid(onPaint);

    act(() => {
      cell('1-1').dispatchEvent(mousePointerEvent('pointerdown'));
      cell('2-1').dispatchEvent(mousePointerEvent('pointermove'));
      cell('3-1').dispatchEvent(mousePointerEvent('pointermove'));
    });

    expect(onPaint).not.toHaveBeenCalled();
    expect(frameCallbacks).toHaveLength(1);

    act(() => {
      frameCallbacks.shift()?.(window.performance.now());
    });

    expect(onPaint).toHaveBeenCalledOnce();
    expect(onPaint).toHaveBeenCalledWith([
      { key: '1-1', state: 'blocked' },
      { key: '2-1', state: 'blocked' },
      { key: '3-1', state: 'blocked' },
    ]);
  });

  it('ignores unrelated pointers and flushes the initiating pointer on cancellation', async () => {
    const onPaint = vi.fn();
    await mountGrid(onPaint);

    act(() => {
      cell('1-1').dispatchEvent(mousePointerEvent('pointerdown', 7));
      cell('2-1').dispatchEvent(mousePointerEvent('pointermove', 8));
      window.dispatchEvent(mousePointerEvent('pointercancel', 8));
      cell('2-1').dispatchEvent(mousePointerEvent('pointermove', 7));
      window.dispatchEvent(mousePointerEvent('pointercancel', 7));
      cell('3-1').dispatchEvent(mousePointerEvent('pointermove', 7));
    });

    expect(onPaint).toHaveBeenCalledOnce();
    expect(onPaint).toHaveBeenCalledWith([
      { key: '1-1', state: 'blocked' },
      { key: '2-1', state: 'blocked' },
    ]);
  });

  it('stops and flushes when pointer movement reports no pressed primary button', async () => {
    const onPaint = vi.fn();
    await mountGrid(onPaint);

    act(() => {
      cell('1-1').dispatchEvent(mousePointerEvent('pointerdown', 4));
      cell('2-1').dispatchEvent(mousePointerEvent('pointermove', 4, 0));
      cell('3-1').dispatchEvent(mousePointerEvent('pointermove', 4, 1));
    });

    expect(onPaint).toHaveBeenCalledOnce();
    expect(onPaint).toHaveBeenCalledWith([
      { key: '1-1', state: 'blocked' },
    ]);
  });
});
