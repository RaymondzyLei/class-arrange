// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import CustomizationModal from './CustomizationModal';
import { DEFAULT_CUSTOM_SETTINGS } from '@/utils/customization';

interface MountedRoot {
  host: HTMLDivElement;
  root: Root;
}

const mountedRoots: MountedRoot[] = [];

async function mount(node: ReactNode): Promise<MountedRoot> {
  const host = document.createElement('div');
  host.dataset.testRoot = 'true';
  document.body.append(host);
  const root = createRoot(host);
  const mounted: MountedRoot = { host, root };
  mountedRoots.push(mounted);
  await act(async () => {
    root.render(node);
  });
  return mounted;
}

function getGridCell(day: number, period: number): HTMLButtonElement {
  const key = `${day}-${period}`;
  const cell = document.querySelector<HTMLButtonElement>(`[data-slot-key="${key}"]`);
  if (!cell) throw new Error(`Missing availability-grid cell for key ${key}`);
  return cell;
}

const originalScrollTo = HTMLElement.prototype.scrollTo;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

function mousePointerEvent(type: 'pointerdown' | 'pointermove'): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    buttons: 1,
  });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom does not implement scrolling APIs; CustomizationModal calls scrollTo on its body ref.
  HTMLElement.prototype.scrollTo = () => {};
});

afterEach(async () => {
  await act(async () => {
    for (const { root } of mountedRoots.splice(0).reverse()) root.unmount();
    await Promise.resolve();
  });
  document.body.replaceChildren();
  HTMLElement.prototype.scrollTo = originalScrollTo;
  if (originalRequestAnimationFrame) window.requestAnimationFrame = originalRequestAnimationFrame;
  else delete (window as Partial<Window>).requestAnimationFrame;
  if (originalCancelAnimationFrame) window.cancelAnimationFrame = originalCancelAnimationFrame;
  else delete (window as Partial<Window>).cancelAnimationFrame;
  vi.useRealTimers();
});

describe('CustomizationModal blocked-slots grid behavior', () => {
  test('clicking an empty cell cycles 空闲 -> 有事 -> 强冲突 -> 空闲', async () => {
    await mount(
      createElement(CustomizationModal, {
        open: true,
        settings: DEFAULT_CUSTOM_SETTINGS,
        onChange: vi.fn(),
        onClose: vi.fn(),
        onRestartOnboarding: vi.fn(),
        showUpdatePopup: true,
        onShowUpdatePopupChange: vi.fn(),
        onOpenUpdateHistory: vi.fn(),
        initialPage: 'blockedSlots',
      }),
    );

    const cell = getGridCell(1, 1);
    const clearButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '清空占位');
    expect(clearButton?.classList.contains('availability-grid-clear-button')).toBe(true);
    expect(cell.getAttribute('aria-label')).toContain('空闲');

    act(() => {
      cell.click();
    });
    expect(cell.getAttribute('aria-label')).toContain('有事');

    act(() => {
      cell.click();
    });
    expect(cell.getAttribute('aria-label')).toContain('强冲突');

    act(() => {
      cell.click();
    });
    expect(cell.getAttribute('aria-label')).toContain('空闲');
  });

  test('clicking a second cell independently marks it 有事 without affecting the first', async () => {
    await mount(
      createElement(CustomizationModal, {
        open: true,
        settings: DEFAULT_CUSTOM_SETTINGS,
        onChange: vi.fn(),
        onClose: vi.fn(),
        onRestartOnboarding: vi.fn(),
        showUpdatePopup: true,
        onShowUpdatePopupChange: vi.fn(),
        onOpenUpdateHistory: vi.fn(),
        initialPage: 'blockedSlots',
      }),
    );

    const first = getGridCell(1, 1);
    const second = getGridCell(2, 2);
    expect(first.getAttribute('aria-label')).toContain('空闲');
    expect(second.getAttribute('aria-label')).toContain('空闲');

    act(() => {
      first.click();
    });
    expect(first.getAttribute('aria-label')).toContain('有事');

    act(() => {
      second.click();
    });
    expect(second.getAttribute('aria-label')).toContain('有事');
    expect(first.getAttribute('aria-label')).toContain('有事');
  });

  test('returning before the next frame preserves every pending drag cell', async () => {
    window.requestAnimationFrame = vi.fn(() => 1);
    window.cancelAnimationFrame = vi.fn();
    const onChange = vi.fn();
    await mount(
      createElement(CustomizationModal, {
        open: true,
        settings: DEFAULT_CUSTOM_SETTINGS,
        onChange,
        onClose: vi.fn(),
        onRestartOnboarding: vi.fn(),
        showUpdatePopup: true,
        onShowUpdatePopupChange: vi.fn(),
        onOpenUpdateHistory: vi.fn(),
        initialPage: 'blockedSlots',
      }),
    );

    const first = getGridCell(1, 1);
    const second = getGridCell(2, 1);
    const backButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('返回'));
    if (!backButton) throw new Error('Missing customization back button');

    act(() => {
      first.dispatchEvent(mousePointerEvent('pointerdown'));
      second.dispatchEvent(mousePointerEvent('pointermove'));
      backButton.click();
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_CUSTOM_SETTINGS,
      blockedSlots: ['1-1', '2-1'],
      hardConflictSlots: [],
    });
  });
});
