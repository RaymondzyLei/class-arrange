import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import {
  getFocusOwner,
  getOverlayStackSnapshot,
  useBodyScrollLock,
  useOverlayStack,
} from './overlayStack';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.tabIndex < 0 || element.closest('[hidden], [inert], [aria-hidden="true"]')) {
      return false;
    }

    let ancestor: HTMLElement | null = element;
    while (ancestor) {
      const style = window.getComputedStyle(ancestor);
      if (
        style.display === 'none'
        || style.visibility === 'hidden'
        || style.visibility === 'collapse'
      ) {
        return false;
      }
      ancestor = ancestor.parentElement;
    }

    return true;
  });
}

function canReceiveRestoredFocus(element: HTMLElement): boolean {
  if (
    typeof document === 'undefined'
    || element === document.body
    || element === document.documentElement
    || !element.isConnected
    || element.getAttribute('aria-disabled') === 'true'
    || element.matches(':disabled')
    || element.closest('[hidden], [inert], [aria-hidden="true"]') !== null
  ) {
    return false;
  }

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

function findBottomModalOverlay(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return Array.from(document.querySelectorAll<HTMLElement>('.bottom-modal[data-overlay-id]'))
    .find((overlay) => overlay.dataset.overlayId === id) ?? null;
}

function focusForCurrentOverlayStack(trigger: HTMLElement | null): void {
  if (typeof document === 'undefined') return;

  const currentSnapshot = getOverlayStackSnapshot();
  const focusOwner = getFocusOwner(currentSnapshot);
  if (!focusOwner) {
    if (trigger && canReceiveRestoredFocus(trigger)) {
      trigger.focus({ preventScroll: true });
    }
    return;
  }

  const topOverlay = findBottomModalOverlay(focusOwner.id);
  if (!topOverlay) return;

  const activeElement = document.activeElement;
  if (activeElement && topOverlay.contains(activeElement)) return;

  if (
    trigger
    && topOverlay.contains(trigger)
    && canReceiveRestoredFocus(trigger)
  ) {
    trigger.focus({ preventScroll: true });
    if (document.activeElement === trigger) return;
  }

  const panel = topOverlay.querySelector<HTMLElement>('.bottom-modal__panel');
  if (!panel) return;
  const fallback = getFocusableElements(panel).find((element) => element !== trigger) ?? panel;
  if (fallback !== trigger) fallback.focus({ preventScroll: true });
}

interface FrozenPresentation {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  width: number;
  titleExtra?: ReactNode;
  headerLeading?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
}

interface Props {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  afterClose?: () => void;
  className?: string;
  width?: number;
  titleExtra?: ReactNode;
  headerLeading?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  bodyRef?: Ref<HTMLDivElement>;
}

export default function BottomModal({
  open,
  title,
  children,
  onClose,
  afterClose,
  className,
  width = 720,
  titleExtra,
  headerLeading,
  footer,
  actions,
  bodyRef,
}: Props) {
  const [present, setPresent] = useState(open);
  const pointerStartedOnMask = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const lastExternalFocusRef = useRef<HTMLElement | null>(null);
  const initialFocusManagedRef = useRef(false);
  const mountedRef = useRef(false);
  const hasCommittedRef = useRef(false);
  const committedOpenRef = useRef(false);
  const committedPresentRef = useRef(present);
  const focusRestorePendingRef = useRef(false);
  const focusGenerationRef = useRef(0);
  const closeGenerationRef = useRef(0);
  const activeCloseGenerationRef = useRef<number | null>(null);
  const finalizedCloseGenerationRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const openRef = useRef(open);
  const afterCloseRef = useRef(afterClose);
  const frozenPresentationRef = useRef<FrozenPresentation>({
    title,
    children,
    className,
    width,
    titleExtra,
    headerLeading,
    footer,
    actions,
  });
  const {
    id,
    zIndex,
    isTop,
    isFocusOwner,
    isInteractionBlocked,
  } = useOverlayStack({
    active: present,
    priority: 1100,
    blocksLowerInteraction: open,
    managesFocus: open,
    onEscape: open ? onClose : undefined,
    escapePassthrough: !open,
  });

  useBodyScrollLock(present);

  const cancelPendingFocusRestore = useCallback(() => {
    focusGenerationRef.current += 1;
  }, []);

  const requestFocusRestore = useCallback((trigger: HTMLElement | null) => {
    const generation = focusGenerationRef.current + 1;
    focusGenerationRef.current = generation;

    queueMicrotask(() => {
      if (focusGenerationRef.current !== generation) return;
      focusForCurrentOverlayStack(trigger);
    });
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = null;
  }, []);

  const finalizeClose = useCallback((generation: number | null) => {
    if (
      generation === null
      || openRef.current
      || activeCloseGenerationRef.current !== generation
      || finalizedCloseGenerationRef.current === generation
    ) {
      return;
    }

    finalizedCloseGenerationRef.current = generation;
    activeCloseGenerationRef.current = null;
    clearCloseTimer();
    focusRestorePendingRef.current = true;
    setPresent(false);
    afterCloseRef.current?.();
  }, [clearCloseTimer]);

  useLayoutEffect(() => {
    openRef.current = open;
    afterCloseRef.current = afterClose;
    if (open) {
      frozenPresentationRef.current = {
        title,
        children,
        className,
        width,
        titleExtra,
        headerLeading,
        footer,
        actions,
      };
    }
  }, [
    actions,
    afterClose,
    children,
    className,
    footer,
    headerLeading,
    open,
    title,
    titleExtra,
    width,
  ]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearCloseTimer();
      const shouldRestoreAfterUnmount =
        committedPresentRef.current || focusRestorePendingRef.current;
      const trigger = triggerRef.current;

      queueMicrotask(() => {
        if (!shouldRestoreAfterUnmount || mountedRef.current) return;
        focusRestorePendingRef.current = false;
        triggerRef.current = null;
        requestFocusRestore(trigger);
      });
    };
  }, [clearCloseTimer, requestFocusRestore]);

  useLayoutEffect(() => {
    const wasOpen = committedOpenRef.current;
    const isFirstCommit = !hasCommittedRef.current;

    if (open && (isFirstCommit || !wasOpen)) {
      cancelPendingFocusRestore();
      focusRestorePendingRef.current = false;
      clearCloseTimer();
      closeGenerationRef.current += 1;
      activeCloseGenerationRef.current = null;
      finalizedCloseGenerationRef.current = null;
      initialFocusManagedRef.current = false;

      if (typeof document !== 'undefined') {
        const activeElement = document.activeElement;
        const panel = panelRef.current;
        const activeOutsidePanel = activeElement instanceof HTMLElement
          && !panel?.contains(activeElement)
          && canReceiveRestoredFocus(activeElement)
          ? activeElement
          : null;
        const previousTrigger = triggerRef.current;
        const lastExternalFocus = lastExternalFocusRef.current;
        triggerRef.current = activeOutsidePanel
          ?? (previousTrigger && canReceiveRestoredFocus(previousTrigger) ? previousTrigger : null)
          ?? (lastExternalFocus && canReceiveRestoredFocus(lastExternalFocus)
            ? lastExternalFocus
            : null);
      }
    } else if (!open && wasOpen) {
      const closeGeneration = closeGenerationRef.current + 1;
      closeGenerationRef.current = closeGeneration;
      activeCloseGenerationRef.current = closeGeneration;
      finalizedCloseGenerationRef.current = null;
      clearCloseTimer();
      pointerStartedOnMask.current = false;
    }

    if (!open && typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement
        && !panelRef.current?.contains(activeElement)
        && canReceiveRestoredFocus(activeElement)
      ) {
        lastExternalFocusRef.current = activeElement;
      }
    }

    hasCommittedRef.current = true;
    committedOpenRef.current = open;
  }, [cancelPendingFocusRestore, clearCloseTimer, open]);

  useLayoutEffect(() => {
    committedPresentRef.current = present;
    if (present || !focusRestorePendingRef.current) return;

    focusRestorePendingRef.current = false;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    requestFocusRestore(trigger);
  }, [present, requestFocusRestore]);

  useEffect(() => {
    if (open) {
      if (!present) setPresent(true);
      return undefined;
    }
    if (!present || typeof window === 'undefined') return undefined;

    const generation = activeCloseGenerationRef.current;
    if (generation === null) return undefined;

    clearCloseTimer();
    const timer = window.setTimeout(() => finalizeClose(generation), 300);
    closeTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (closeTimerRef.current === timer) closeTimerRef.current = null;
    };
  }, [clearCloseTimer, finalizeClose, open, present]);

  useLayoutEffect(() => {
    if (
      !open
      || !present
      || !isFocusOwner
      || isInteractionBlocked
      || initialFocusManagedRef.current
      || typeof document === 'undefined'
    ) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) return;
    initialFocusManagedRef.current = true;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && panel.contains(activeElement)) return;

    const [firstFocusable] = getFocusableElements(panel);
    (firstFocusable ?? panel).focus({ preventScroll: true });
  }, [isFocusOwner, isInteractionBlocked, open, present]);

  useEffect(() => {
    if (!open || !present || !isFocusOwner || isInteractionBlocked) return undefined;

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

      const panel = panelRef.current;
      if (!panel) return;

      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
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
          lastFocusable?.focus({ preventScroll: true });
        }
        return;
      }

      if (activeIndex === -1 || activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFocusOwner, isInteractionBlocked, open, present]);

  if (!present || typeof document === 'undefined') return null;

  const presentation = open
    ? { title, children, className, width, titleExtra, headerLeading, footer, actions }
    : frozenPresentationRef.current;
  const isInteractive = open && !isInteractionBlocked;

  return createPortal(
    <div
      className={`bottom-modal${presentation.className ? ` ${presentation.className}` : ''}`}
      data-state={open ? 'open' : 'closed'}
      data-overlay-id={id}
      data-overlay-top={isTop ? 'true' : 'false'}
      data-overlay-focus-owner={isFocusOwner ? 'true' : 'false'}
      style={{ zIndex }}
      inert={!isInteractive}
      aria-hidden={isInteractive ? undefined : true}
      onPointerDown={(event) => {
        if (!isInteractive) {
          pointerStartedOnMask.current = false;
          return;
        }
        pointerStartedOnMask.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        if (!isInteractive) {
          pointerStartedOnMask.current = false;
          return;
        }
        const endedOnMask = event.target === event.currentTarget;
        if (pointerStartedOnMask.current && endedOnMask) onClose();
        pointerStartedOnMask.current = false;
      }}
    >
      <section
        className="bottom-modal__panel"
        style={{ width: `min(100%, ${presentation.width}px)` }}
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={open && isTop && isFocusOwner && !isInteractionBlocked ? true : undefined}
        aria-label={typeof presentation.title === 'string' ? presentation.title : undefined}
        onAnimationEnd={(event) => {
          if (
            open
            || event.target !== event.currentTarget
            || !event.animationName.endsWith('panel-out')
          ) {
            return;
          }
          finalizeClose(activeCloseGenerationRef.current);
        }}
      >
        <div className="bottom-modal__header">
          <div className="bottom-modal__heading">
            {presentation.headerLeading ?? (
              <>
                <h2 className="bottom-modal__title">{presentation.title}</h2>
                {presentation.titleExtra ? (
                  <div className="bottom-modal__title-extra">{presentation.titleExtra}</div>
                ) : null}
              </>
            )}
          </div>
          {presentation.actions ? (
            <div className="bottom-modal__actions">{presentation.actions}</div>
          ) : null}
          <button className="bottom-modal__close" type="button" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <div className="bottom-modal__body" ref={bodyRef}>{presentation.children}</div>
        {presentation.footer ? (
          <div className="bottom-modal__footer">{presentation.footer}</div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
