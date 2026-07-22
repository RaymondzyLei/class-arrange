import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

export const DEFAULT_OVERLAY_PRIORITY = 1100;

export interface OverlayStackSnapshotEntry {
  readonly id: string;
  readonly priority: number;
  readonly blocksLowerInteraction: boolean;
  readonly managesFocus: boolean;
  readonly escapePassthrough: boolean;
  readonly activationOrder: number;
  readonly zIndex: number;
}

export type OverlayStackSnapshot = readonly OverlayStackSnapshotEntry[];

export interface UseOverlayStackOptions {
  readonly active: boolean;
  readonly priority?: number;
  readonly blocksLowerInteraction?: boolean;
  readonly managesFocus?: boolean;
  readonly onEscape?: () => void;
  readonly escapePassthrough?: boolean;
}

export interface UseOverlayStackResult {
  readonly id: string;
  readonly isTop: boolean;
  readonly isFocusOwner: boolean;
  readonly isTopBlocking: boolean;
  readonly isInteractionBlocked: boolean;
  readonly zIndex: number;
}

interface RegistryEntry {
  readonly id: string;
  active: boolean;
  priority: number;
  blocksLowerInteraction: boolean;
  managesFocus: boolean;
  escapePassthrough: boolean;
  activationOrder: number;
  readonly onEscapeRef: { current: (() => void) | undefined };
}

interface EntryConfiguration {
  readonly active: boolean;
  readonly priority: number;
  readonly blocksLowerInteraction: boolean;
  readonly managesFocus: boolean;
  readonly escapePassthrough: boolean;
}

const registry = new Map<string, RegistryEntry>();
const subscribers = new Set<() => void>();
const emptySnapshot: OverlayStackSnapshot = Object.freeze([]);

let activationCounter = 0;
let snapshot: OverlayStackSnapshot = emptySnapshot;
let keydownListenerAttached = false;

const useIsomorphicLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

function normalizePriority(priority: number | undefined): number {
  return priority !== undefined && Number.isFinite(priority)
    ? priority
    : DEFAULT_OVERLAY_PRIORITY;
}

function compareEntries(a: RegistryEntry, b: RegistryEntry): number {
  return a.priority - b.priority || a.activationOrder - b.activationOrder;
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (
    event.key !== "Escape" ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing
  ) {
    return;
  }

  for (let index = snapshot.length - 1; index >= 0; index -= 1) {
    const item = snapshot[index];
    if (item === undefined) continue;

    const onEscape = registry.get(item.id)?.onEscapeRef.current;
    if (onEscape !== undefined) {
      event.preventDefault();
      onEscape();
      return;
    }
    if (!item.escapePassthrough) return;
  }
}

function syncDocumentKeydownListener(): void {
  if (typeof document === "undefined") {
    return;
  }

  const shouldBeAttached = snapshot.length > 0;
  if (shouldBeAttached === keydownListenerAttached) {
    return;
  }

  if (shouldBeAttached) {
    document.addEventListener("keydown", handleDocumentKeydown);
  } else {
    document.removeEventListener("keydown", handleDocumentKeydown);
  }
  keydownListenerAttached = shouldBeAttached;
}

function rebuildSnapshot(): void {
  const activeEntries = Array.from(registry.values())
    .filter((entry) => entry.active)
    .sort(compareEntries);

  if (activeEntries.length === 0) {
    snapshot = emptySnapshot;
  } else {
    let previousZIndex: number | undefined;
    snapshot = Object.freeze(activeEntries.map((entry) => {
      const zIndex =
        previousZIndex === undefined
          ? entry.priority
          : Math.max(entry.priority, previousZIndex + 1);
      previousZIndex = zIndex;

      return Object.freeze({
        id: entry.id,
        priority: entry.priority,
        blocksLowerInteraction: entry.blocksLowerInteraction,
        managesFocus: entry.managesFocus,
        escapePassthrough: entry.escapePassthrough,
        activationOrder: entry.activationOrder,
        zIndex,
      });
    }));
  }

  syncDocumentKeydownListener();
  subscribers.forEach((subscriber) => subscriber());
}

function registerEntry(
  entry: RegistryEntry,
  configuration: EntryConfiguration,
): () => void {
  entry.active = configuration.active;
  entry.priority = configuration.priority;
  entry.blocksLowerInteraction = configuration.blocksLowerInteraction;
  entry.managesFocus = configuration.managesFocus;
  entry.escapePassthrough = configuration.escapePassthrough;
  if (entry.active && entry.activationOrder === 0) {
    entry.activationOrder = ++activationCounter;
  }

  registry.set(entry.id, entry);
  if (entry.active) {
    rebuildSnapshot();
  }

  return () => {
    if (registry.get(entry.id) !== entry) {
      return;
    }

    registry.delete(entry.id);
    if (entry.active) {
      rebuildSnapshot();
    }
  };
}

function updateEntry(
  entry: RegistryEntry,
  configuration: EntryConfiguration,
): void {
  if (registry.get(entry.id) !== entry) {
    return;
  }

  const wasActive = entry.active;
  const wasEscapePassthrough = entry.escapePassthrough;
  const changed =
    wasActive !== configuration.active ||
    entry.priority !== configuration.priority ||
    entry.blocksLowerInteraction !== configuration.blocksLowerInteraction ||
    entry.managesFocus !== configuration.managesFocus ||
    entry.escapePassthrough !== configuration.escapePassthrough;

  if (!changed) {
    return;
  }

  entry.active = configuration.active;
  entry.priority = configuration.priority;
  entry.blocksLowerInteraction = configuration.blocksLowerInteraction;
  entry.managesFocus = configuration.managesFocus;
  entry.escapePassthrough = configuration.escapePassthrough;
  if (
    (!wasActive && entry.active) ||
    (wasActive && entry.active && wasEscapePassthrough && !entry.escapePassthrough)
  ) {
    entry.activationOrder = ++activationCounter;
  }

  if (wasActive || entry.active) {
    rebuildSnapshot();
  }
}

export function getOverlayStackSnapshot(): OverlayStackSnapshot {
  return snapshot;
}

export function getFocusOwner(
  currentSnapshot: OverlayStackSnapshot = snapshot,
): OverlayStackSnapshotEntry | undefined {
  for (let index = currentSnapshot.length - 1; index >= 0; index -= 1) {
    const item = currentSnapshot[index];
    if (item?.managesFocus) return item;
  }
  return undefined;
}

export function subscribeOverlayStack(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function useOverlayStackSnapshot(): OverlayStackSnapshot {
  return useSyncExternalStore(
    subscribeOverlayStack,
    getOverlayStackSnapshot,
    getOverlayStackSnapshot,
  );
}

export function useOverlayStack({
  active,
  priority,
  blocksLowerInteraction = true,
  managesFocus = blocksLowerInteraction,
  onEscape,
  escapePassthrough = false,
}: UseOverlayStackOptions): UseOverlayStackResult {
  const reactId = useId();
  const id = `overlay-stack-${reactId}`;
  const onEscapeRef = useRef<(() => void) | undefined>(undefined);

  useIsomorphicLayoutEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  const entryRef = useRef<RegistryEntry | null>(null);
  if (entryRef.current === null) {
    entryRef.current = {
      id,
      active: false,
      priority: DEFAULT_OVERLAY_PRIORITY,
      blocksLowerInteraction: true,
      managesFocus: true,
      escapePassthrough: false,
      activationOrder: 0,
      onEscapeRef,
    };
  }

  const normalizedPriority = normalizePriority(priority);
  const configurationRef = useRef<EntryConfiguration>({
    active,
    priority: normalizedPriority,
    blocksLowerInteraction,
    managesFocus,
    escapePassthrough,
  });
  configurationRef.current = {
    active,
    priority: normalizedPriority,
    blocksLowerInteraction,
    managesFocus,
    escapePassthrough,
  };

  const entry = entryRef.current;

  useIsomorphicLayoutEffect(
    () => registerEntry(entry, configurationRef.current),
    [entry],
  );

  useIsomorphicLayoutEffect(() => {
    updateEntry(entry, {
      active,
      priority: normalizedPriority,
      blocksLowerInteraction,
      managesFocus,
      escapePassthrough,
    });
  }, [
    active,
    blocksLowerInteraction,
    entry,
    escapePassthrough,
    managesFocus,
    normalizedPriority,
  ]);

  const currentSnapshot = useOverlayStackSnapshot();
  const stackIndex = currentSnapshot.findIndex((item) => item.id === id);
  const isRegisteredAndActive = stackIndex !== -1;
  const isTop =
    isRegisteredAndActive && stackIndex === currentSnapshot.length - 1;

  const focusOwner = getFocusOwner(currentSnapshot);

  let topBlockingIndex = -1;
  for (let index = currentSnapshot.length - 1; index >= 0; index -= 1) {
    if (currentSnapshot[index]?.blocksLowerInteraction) {
      topBlockingIndex = index;
      break;
    }
  }

  let isInteractionBlocked = false;
  if (isRegisteredAndActive) {
    for (
      let index = stackIndex + 1;
      index < currentSnapshot.length;
      index += 1
    ) {
      if (currentSnapshot[index]?.blocksLowerInteraction) {
        isInteractionBlocked = true;
        break;
      }
    }
  }

  return {
    id,
    isTop,
    isFocusOwner: isRegisteredAndActive && focusOwner?.id === id,
    isTopBlocking:
      isRegisteredAndActive && stackIndex === topBlockingIndex,
    isInteractionBlocked,
    zIndex: isRegisteredAndActive
      ? (currentSnapshot[stackIndex]?.zIndex ?? normalizedPriority)
      : normalizedPriority,
  };
}

let bodyScrollLockCount = 0;
let lockedBody: HTMLElement | null = null;
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";

export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => undefined;
  }

  const body = document.body;
  if (body === null) {
    return () => undefined;
  }

  if (bodyScrollLockCount === 0) {
    lockedBody = body;
    previousBodyOverflow = body.style.overflow;
    previousBodyPaddingRight = body.style.paddingRight;

    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth,
    );
    if (scrollbarWidth > 0) {
      const computedPaddingRight = Number.parseFloat(
        window.getComputedStyle(body).paddingRight,
      );
      body.style.paddingRight = `${
        (Number.isFinite(computedPaddingRight) ? computedPaddingRight : 0) +
        scrollbarWidth
      }px`;
    }
    body.style.overflow = "hidden";
  }

  bodyScrollLockCount += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;

    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount !== 0 || lockedBody === null) {
      return;
    }

    lockedBody.style.overflow = previousBodyOverflow;
    lockedBody.style.paddingRight = previousBodyPaddingRight;
    lockedBody = null;
    previousBodyOverflow = "";
    previousBodyPaddingRight = "";
  };
}

export function useBodyScrollLock(active = true): void {
  useIsomorphicLayoutEffect(() => {
    if (!active) {
      return undefined;
    }

    return acquireBodyScrollLock();
  }, [active]);
}
