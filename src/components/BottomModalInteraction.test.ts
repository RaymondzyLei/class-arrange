// @vitest-environment jsdom

import {
  Fragment,
  act,
  createElement,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import BottomModal from './BottomModal';
import { getFocusOwner, getOverlayStackSnapshot, useOverlayStack } from './overlayStack';

type BottomModalProps = ComponentProps<typeof BottomModal>;

interface MountedRoot {
  host: HTMLDivElement;
  root: Root;
  rerender: (node: ReactNode) => Promise<void>;
}

interface Layer {
  id: string;
  open: boolean;
  onClose: () => void;
  options?: ModalOptions;
}

type ModalOptions = Partial<
  Omit<BottomModalProps, 'open' | 'title' | 'children' | 'onClose'>
> & {
  title?: ReactNode;
  children?: ReactNode;
};

const mountedRoots: MountedRoot[] = [];

function modal(
  id: string,
  open: boolean,
  onClose: () => void,
  options: ModalOptions = {},
): ReactNode {
  const {
    title = id,
    children = createElement('button', { id: `${id}-button`, type: 'button' }, `${id} action`),
    ...rest
  } = options;
  const props: BottomModalProps = {
    ...rest,
    open,
    title,
    children,
    onClose,
  };

  return createElement(BottomModal, { ...props, key: id });
}

function stack(layers: readonly Layer[]): ReactNode {
  return createElement(
    Fragment,
    null,
    layers.map(({ id, open, onClose, options }) => modal(id, open, onClose, options)),
  );
}

function EscapeOnlyOverlay({ onEscape }: { onEscape: () => void }): ReactNode {
  const { id, isTop, isFocusOwner, zIndex } = useOverlayStack({
    active: true,
    priority: 1350,
    blocksLowerInteraction: false,
    managesFocus: false,
    onEscape,
  });

  return createElement('div', {
    'data-escape-only-overlay': 'true',
    'data-overlay-id': id,
    'data-overlay-top': isTop ? 'true' : 'false',
    'data-overlay-focus-owner': isFocusOwner ? 'true' : 'false',
    style: { zIndex },
  });
}

async function mount(node: ReactNode): Promise<MountedRoot> {
  const host = document.createElement('div');
  host.dataset.testRoot = 'true';
  document.body.append(host);
  const root = createRoot(host);
  const mounted: MountedRoot = {
    host,
    root,
    rerender: async (nextNode) => {
      await act(async () => {
        root.render(nextNode);
      });
    },
  };
  mountedRoots.push(mounted);
  await mounted.rerender(node);
  return mounted;
}

function getPanel(title: string): HTMLElement {
  const panel = Array.from(document.querySelectorAll<HTMLElement>('.bottom-modal__panel'))
    .find((candidate) => candidate.getAttribute('aria-label') === title);
  if (!panel) throw new Error(`Missing modal panel: ${title}`);
  return panel;
}

function getOverlay(title: string): HTMLElement {
  const overlay = getPanel(title).closest<HTMLElement>('.bottom-modal');
  if (!overlay) throw new Error(`Missing modal overlay: ${title}`);
  return overlay;
}

function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    ...init,
  });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

async function animationEnd(target: Element, animationName: string): Promise<void> {
  // jsdom has WebkitAnimation style support but no AnimationEvent constructor,
  // so React registers its synthetic onAnimationEnd listener for the prefixed event.
  const event = new Event('webkitAnimationEnd', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  await act(async () => {
    target.dispatchEvent(event);
    await Promise.resolve();
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    for (const { root } of mountedRoots.splice(0).reverse()) root.unmount();
    await Promise.resolve();
  });

  expect(getOverlayStackSnapshot()).toHaveLength(0);
  document.body.replaceChildren();
  document.body.removeAttribute('tabindex');
  document.body.style.cssText = '';
  document.documentElement.style.cssText = '';
  vi.useRealTimers();
});

describe('BottomModal DOM interactions', () => {
  test.each([2, 3])(
    'closes one of %i stacked layers per Escape, including through exiting layers',
    async (layerCount) => {
      vi.useFakeTimers();
      const closeCallbacks = Array.from({ length: layerCount }, () => vi.fn());
      const layers: Layer[] = closeCallbacks.map((onClose, index) => ({
        id: `layer-${index + 1}`,
        open: true,
        onClose,
      }));
      const mounted = await mount(stack(layers));

      expect(getOverlayStackSnapshot()).toHaveLength(layerCount);

      for (let index = layerCount - 1; index >= 0; index -= 1) {
        const event = keydown('Escape');
        expect(event.defaultPrevented).toBe(true);
        expect(closeCallbacks.reduce((total, callback) => total + callback.mock.calls.length, 0))
          .toBe(layerCount - index);
        expect(closeCallbacks[index]).toHaveBeenCalledTimes(1);

        layers[index] = { ...layers[index]!, open: false };
        await mounted.rerender(stack(layers));
        expect(getOverlay(`layer-${index + 1}`).dataset.state).toBe('closed');
      }

      expect(document.querySelectorAll('.bottom-modal')).toHaveLength(layerCount);
    },
  );

  test('keeps activation order stable when close callbacks rerender', async () => {
    const oldLowerClose = vi.fn();
    const oldUpperClose = vi.fn();
    const mounted = await mount(stack([
      { id: 'lower', open: true, onClose: oldLowerClose },
      { id: 'upper', open: true, onClose: oldUpperClose },
    ]));
    const before = getOverlayStackSnapshot().map(({ id, activationOrder, zIndex }) => ({
      id,
      activationOrder,
      zIndex,
    }));
    const newLowerClose = vi.fn();
    const newUpperClose = vi.fn();

    await mounted.rerender(stack([
      { id: 'lower', open: true, onClose: newLowerClose },
      { id: 'upper', open: true, onClose: newUpperClose },
    ]));

    expect(getOverlayStackSnapshot().map(({ id, activationOrder, zIndex }) => ({
      id,
      activationOrder,
      zIndex,
    }))).toEqual(before);
    keydown('Escape');
    expect(newUpperClose).toHaveBeenCalledTimes(1);
    expect(newLowerClose).not.toHaveBeenCalled();
    expect(oldUpperClose).not.toHaveBeenCalled();
    expect(oldLowerClose).not.toHaveBeenCalled();
  });

  test('ignores repeated, composing, and already-prevented Escape events', async () => {
    const onClose = vi.fn();
    await mount(modal('escape-guards', true, onClose));

    keydown('Escape', { repeat: true });
    keydown('Escape', { isComposing: true });
    const prevented = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    });
    prevented.preventDefault();
    act(() => {
      document.dispatchEvent(prevented);
    });

    expect(onClose).not.toHaveBeenCalled();
    const ordinary = keydown('Escape');
    expect(ordinary.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('separates the Escape owner from the focus owner under a non-modal tour layer', async () => {
    const onModalClose = vi.fn();
    const onTourEscape = vi.fn();
    await mount(createElement(
      Fragment,
      null,
      modal('tour-opened-modal', true, onModalClose, {
        children: createElement(
          Fragment,
          null,
          createElement('button', { id: 'modal-first', type: 'button' }, 'first'),
          createElement('button', { id: 'modal-last', type: 'button' }, 'last'),
        ),
      }),
      createElement(EscapeOnlyOverlay, { onEscape: onTourEscape }),
    ));

    const panel = getPanel('tour-opened-modal');
    const bottomModalOverlay = getOverlay('tour-opened-modal');
    const escapeOnlyOverlay = document.querySelector<HTMLElement>(
      '[data-escape-only-overlay="true"]',
    )!;
    const focusOwner = getFocusOwner();

    expect(focusOwner?.id).toBe(bottomModalOverlay.dataset.overlayId);
    expect(escapeOnlyOverlay.dataset.overlayTop).toBe('true');
    expect(escapeOnlyOverlay.dataset.overlayFocusOwner).toBe('false');
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(panel.getAttribute('aria-modal')).toBeNull();

    const last = document.querySelector<HTMLElement>('#modal-last')!;
    const first = panel.querySelector<HTMLElement>('.bottom-modal__close')!;
    last.focus();
    const tab = keydown('Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const escape = keydown('Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(onTourEscape).toHaveBeenCalledTimes(1);
    expect(onModalClose).not.toHaveBeenCalled();
  });

  test('excludes focusables hidden by ancestors and traps Tab within the panel', async () => {
    const children = createElement(
      'div',
      null,
      createElement('div', { hidden: true },
        createElement('button', { id: 'hidden-by-attribute', type: 'button' }, 'hidden')),
      createElement('div', { 'aria-hidden': true },
        createElement('button', { id: 'hidden-by-aria', type: 'button' }, 'hidden')),
      createElement('div', { style: { display: 'none' } },
        createElement('button', { id: 'hidden-by-display', type: 'button' }, 'hidden')),
      createElement('div', { style: { visibility: 'hidden' } },
        createElement('button', { id: 'hidden-by-visibility', type: 'button' }, 'hidden')),
      createElement('button', { id: 'first-visible', type: 'button' }, 'first'),
      createElement('button', { id: 'last-visible', type: 'button' }, 'last'),
    );
    await mount(modal('focus-trap', true, vi.fn(), { children }));
    const first = document.querySelector<HTMLElement>('#first-visible')!;
    const last = document.querySelector<HTMLElement>('#last-visible')!;
    const panel = getPanel('focus-trap');
    const header = panel.querySelector<HTMLElement>('.bottom-modal__header')!;

    header.hidden = true;
    panel.focus();
    const enterTrap = keydown('Tab');
    expect(enterTrap.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    last.focus();
    const forward = keydown('Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const backward = keydown('Tab', { shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  test('restores focus to a nested trigger and then to the external trigger', async () => {
    const externalTrigger = document.createElement('button');
    externalTrigger.id = 'external-trigger';
    document.body.append(externalTrigger);
    externalTrigger.focus();
    const parentChildren = createElement(
      'div',
      null,
      createElement('button', { id: 'open-child', type: 'button' }, 'open child'),
      createElement('button', { id: 'parent-last', type: 'button' }, 'parent last'),
    );
    const childChildren = createElement(
      'button',
      { id: 'child-action', type: 'button' },
      'child action',
    );
    const parent = { id: 'parent', open: true, onClose: vi.fn(), options: { children: parentChildren } };
    const child = { id: 'child', open: true, onClose: vi.fn(), options: { children: childChildren } };
    const mounted = await mount(stack([parent]));
    const nestedTrigger = document.querySelector<HTMLElement>('#open-child')!;

    nestedTrigger.focus();
    await mounted.rerender(stack([parent, child]));
    expect(document.activeElement).toBe(
      getPanel('child').querySelector('.bottom-modal__close'),
    );

    await mounted.rerender(stack([parent, { ...child, open: false }]));
    await animationEnd(getPanel('child'), 'bottom-modal-panel-out');
    expect(document.activeElement).toBe(nestedTrigger);

    await mounted.rerender(stack([{ ...parent, open: false }]));
    await animationEnd(getPanel('parent'), 'bottom-modal-panel-out');
    expect(document.activeElement).toBe(externalTrigger);
  });

  test('does not let an old modal restore focus over a newly opened modal', async () => {
    const externalTrigger = document.createElement('button');
    document.body.append(externalTrigger);
    externalTrigger.focus();
    const oldLayer = { id: 'old', open: true, onClose: vi.fn() };
    const newLayer = { id: 'new', open: true, onClose: vi.fn() };
    const mounted = await mount(stack([oldLayer]));

    await mounted.rerender(stack([{ ...oldLayer, open: false }, newLayer]));
    const newInitialFocus = getPanel('new').querySelector<HTMLElement>('.bottom-modal__close')!;
    expect(document.activeElement).toBe(newInitialFocus);

    await animationEnd(getPanel('old'), 'bottom-modal-panel-out');
    expect(document.activeElement).toBe(newInitialFocus);
    expect(document.activeElement).not.toBe(externalTrigger);
  });

  test('preserves the original trigger when a closing modal reopens while body has focus', async () => {
    const externalTrigger = document.createElement('button');
    externalTrigger.id = 'reopen-external-trigger';
    document.body.append(externalTrigger);
    externalTrigger.focus();
    const onClose = vi.fn();
    const mounted = await mount(modal('reopen-focus', true, onClose));

    await mounted.rerender(modal('reopen-focus', false, onClose));
    document.body.tabIndex = -1;
    document.body.focus();
    expect(document.activeElement).toBe(document.body);

    await mounted.rerender(modal('reopen-focus', true, onClose));
    expect(getPanel('reopen-focus').contains(document.activeElement)).toBe(true);

    await mounted.rerender(modal('reopen-focus', false, onClose));
    await animationEnd(getPanel('reopen-focus'), 'bottom-modal-panel-out');

    expect(document.activeElement).toBe(externalTrigger);
    document.body.removeAttribute('tabindex');
  });

  test('reference-counts body scroll locking until every exit finishes', async () => {
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '7px';
    const lower = { id: 'scroll-lower', open: true, onClose: vi.fn() };
    const upper = { id: 'scroll-upper', open: true, onClose: vi.fn() };
    const mounted = await mount(stack([lower, upper]));

    expect(document.body.style.overflow).toBe('hidden');
    await mounted.rerender(stack([
      { ...lower, open: false },
      { ...upper, open: false },
    ]));
    expect(document.body.style.overflow).toBe('hidden');

    await animationEnd(getPanel('scroll-lower'), 'bottom-modal-panel-out');
    expect(document.body.style.overflow).toBe('hidden');
    await animationEnd(getPanel('scroll-upper'), 'bottom-modal-panel-out');

    expect(document.querySelectorAll('.bottom-modal')).toHaveLength(0);
    expect(getOverlayStackSnapshot()).toHaveLength(0);
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.paddingRight).toBe('7px');
  });

  test('freezes the open presentation and makes the closing layer inert', async () => {
    const mounted = await mount(modal('frozen', true, vi.fn(), {
      title: 'Original title',
      actions: createElement('span', null, 'Original action'),
      children: createElement('p', null, 'Original body'),
      className: 'original-class',
      footer: createElement('span', null, 'Original footer'),
      width: 480,
    }));

    await mounted.rerender(modal('frozen', false, vi.fn(), {
      title: 'Changed title',
      actions: createElement('span', null, 'Changed action'),
      children: createElement('p', null, 'Changed body'),
      className: 'changed-class',
      footer: createElement('span', null, 'Changed footer'),
      width: 900,
    }));

    const overlay = getOverlay('Original title');
    expect(overlay.dataset.state).toBe('closed');
    expect(overlay.hasAttribute('inert')).toBe(true);
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.classList).toContain('original-class');
    expect(overlay.classList).not.toContain('changed-class');
    expect(overlay.textContent).toContain('Original action');
    expect(overlay.textContent).toContain('Original body');
    expect(overlay.textContent).toContain('Original footer');
    expect(overlay.textContent).not.toContain('Changed');
  });

  test('only accepts the panel-out animation and finalizes a close once', async () => {
    vi.useFakeTimers();
    const afterClose = vi.fn();
    const mounted = await mount(modal('animated', true, vi.fn(), { afterClose }));
    await mounted.rerender(modal('animated', false, vi.fn(), { afterClose }));
    const panel = getPanel('animated');
    const body = panel.querySelector('.bottom-modal__body')!;

    await animationEnd(body, 'bottom-modal-panel-out');
    await animationEnd(panel, 'bottom-modal-mask-out');
    expect(afterClose).not.toHaveBeenCalled();
    expect(getOverlay('animated').isConnected).toBe(true);

    await animationEnd(panel, 'bottom-modal-panel-out');
    expect(afterClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.bottom-modal')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(afterClose).toHaveBeenCalledTimes(1);
  });

  test('falls back after 300 ms and remains idempotent', async () => {
    vi.useFakeTimers();
    const afterClose = vi.fn();
    const mounted = await mount(modal('fallback', true, vi.fn(), { afterClose }));
    await mounted.rerender(modal('fallback', false, vi.fn(), { afterClose }));

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(afterClose).not.toHaveBeenCalled();
    expect(getOverlay('fallback')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(afterClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.bottom-modal')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(afterClose).toHaveBeenCalledTimes(1);
  });
});
