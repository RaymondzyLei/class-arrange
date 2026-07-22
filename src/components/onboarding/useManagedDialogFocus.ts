import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { getFocusOwner, getOverlayStackSnapshot } from '@/components/overlayStack';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect;

interface ElementRef<T extends HTMLElement> {
  readonly current: T | null;
}

interface UseManagedDialogFocusOptions {
  readonly active: boolean;
  readonly interactive: boolean;
  readonly containerRef: ElementRef<HTMLElement>;
  readonly initialFocusRef?: ElementRef<HTMLElement>;
  readonly returnFocusTarget?: HTMLElement | null;
}

function isVisible(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    const style = window.getComputedStyle(current);
    if (
      style.display === 'none'
      || style.visibility === 'hidden'
      || style.visibility === 'collapse'
    ) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function canReceiveFocus(element: HTMLElement): boolean {
  return element.isConnected
    && element.getAttribute('aria-disabled') !== 'true'
    && !element.matches(':disabled')
    && element.closest('[hidden], [inert], [aria-hidden="true"]') === null
    && isVisible(element);
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.tabIndex >= 0 && canReceiveFocus(element));
}

function focusElement(element: HTMLElement): void {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function findOverlayElement(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return Array.from(document.querySelectorAll<HTMLElement>('[data-overlay-id]'))
    .find((element) => element.dataset.overlayId === id) ?? null;
}

function restoreFocusForCurrentOverlayStack(trigger: HTMLElement | null): void {
  if (typeof document === 'undefined') return;

  const currentSnapshot = getOverlayStackSnapshot();
  const focusOwner = getFocusOwner(currentSnapshot);

  if (!focusOwner) {
    if (trigger && canReceiveFocus(trigger)) focusElement(trigger);
    return;
  }

  const overlay = findOverlayElement(focusOwner.id);
  if (!overlay) return;

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLElement
    && overlay.contains(activeElement)
    && canReceiveFocus(activeElement)
  ) {
    return;
  }

  if (trigger && overlay.contains(trigger) && canReceiveFocus(trigger)) {
    focusElement(trigger);
    if (document.activeElement === trigger) return;
  }

  const focusRoot = overlay.querySelector<HTMLElement>(
    '[data-overlay-focus-root], [role="alertdialog"], [role="dialog"]',
  ) ?? overlay;
  const fallback = getFocusableElements(focusRoot)[0]
    ?? (focusRoot.tabIndex >= 0 && canReceiveFocus(focusRoot) ? focusRoot : null);
  if (fallback) focusElement(fallback);
}

export function useManagedDialogFocus({
  active,
  interactive,
  containerRef,
  initialFocusRef,
  returnFocusTarget,
}: UseManagedDialogFocusOptions): void {
  const committedActiveRef = useRef(false);
  const hasCommittedRef = useRef(false);
  const initialFocusManagedRef = useRef(false);
  const mountedRef = useRef(false);
  const restoreGenerationRef = useRef(0);
  const triggerRef = useRef<HTMLElement | null>(null);

  const cancelPendingRestore = useCallback(() => {
    restoreGenerationRef.current += 1;
  }, []);

  const requestFocusRestore = useCallback((
    trigger: HTMLElement | null,
    requireUnmounted = false,
  ) => {
    const generation = restoreGenerationRef.current + 1;
    restoreGenerationRef.current = generation;

    queueMicrotask(() => {
      if (
        restoreGenerationRef.current !== generation
        || (requireUnmounted && mountedRef.current)
      ) {
        return;
      }
      restoreFocusForCurrentOverlayStack(trigger);
    });
  }, []);

  useIsomorphicLayoutEffect(() => {
    mountedRef.current = true;
    cancelPendingRestore();
    return () => {
      mountedRef.current = false;
      if (!committedActiveRef.current) return;

      const trigger = triggerRef.current;
      requestFocusRestore(trigger, true);
    };
  }, [cancelPendingRestore, requestFocusRestore]);

  useIsomorphicLayoutEffect(() => {
    const wasActive = committedActiveRef.current;
    const isFirstCommit = !hasCommittedRef.current;

    if (active && (isFirstCommit || !wasActive)) {
      cancelPendingRestore();
      initialFocusManagedRef.current = false;

      if (typeof document !== 'undefined') {
        const activeElement = document.activeElement;
        const container = containerRef.current;
        const explicitTarget = returnFocusTarget
          && returnFocusTarget !== document.body
          && returnFocusTarget.isConnected
          ? returnFocusTarget
          : null;
        triggerRef.current = explicitTarget ?? (
          activeElement instanceof HTMLElement
            && activeElement !== document.body
            && !container?.contains(activeElement)
            && activeElement.isConnected
            ? activeElement
            : null
        );
      }
    } else if (!active && wasActive) {
      initialFocusManagedRef.current = false;
      const trigger = triggerRef.current;
      triggerRef.current = null;
      requestFocusRestore(trigger);
    }

    hasCommittedRef.current = true;
    committedActiveRef.current = active;
  }, [
    active,
    cancelPendingRestore,
    containerRef,
    requestFocusRestore,
    returnFocusTarget,
  ]);

  useIsomorphicLayoutEffect(() => {
    if (
      !active
      || !interactive
      || initialFocusManagedRef.current
      || typeof document === 'undefined'
    ) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    initialFocusManagedRef.current = true;

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement
      && container.contains(activeElement)
      && canReceiveFocus(activeElement)
    ) {
      return;
    }

    const requestedInitialFocus = initialFocusRef?.current;
    const initialFocus = requestedInitialFocus
      && container.contains(requestedInitialFocus)
      && canReceiveFocus(requestedInitialFocus)
      ? requestedInitialFocus
      : getFocusableElements(container)[0] ?? container;
    focusElement(initialFocus);
  }, [active, containerRef, initialFocusRef, interactive]);

  useEffect(() => {
    if (!active || !interactive || typeof document === 'undefined') {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Tab'
        || event.defaultPrevented
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusElement(container);
        return;
      }

      const activeElement = document.activeElement;
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeIndex = activeElement instanceof HTMLElement
        ? focusableElements.indexOf(activeElement)
        : -1;

      if (event.shiftKey) {
        if (activeIndex <= 0) {
          event.preventDefault();
          if (lastFocusable) focusElement(lastFocusable);
        }
        return;
      }

      if (activeIndex === -1 || activeElement === lastFocusable) {
        event.preventDefault();
        if (firstFocusable) focusElement(firstFocusable);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, containerRef, interactive]);
}
