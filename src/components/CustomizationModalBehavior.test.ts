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
});
