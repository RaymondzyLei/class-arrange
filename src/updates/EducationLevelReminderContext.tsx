import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { detectExistingVisitor } from './updateAwareness';
import {
  initializeEducationLevelReminder,
  markEducationLevelReminderSeen,
  type EducationLevelReminderStorage,
} from './educationLevelReminder';

interface BrowserStorage extends EducationLevelReminderStorage {
  length?: number;
  key?(index: number): string | null;
}

interface EducationLevelReminderValue {
  pending: boolean;
  acknowledge: () => void;
}

interface EducationLevelReminderProviderProps {
  children: ReactNode;
  storage?: BrowserStorage;
}

const EducationLevelReminderContext = createContext<EducationLevelReminderValue | null>(null);

function browserStorage(): BrowserStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

/**
 * Captures visitor status before descendant providers can create plan storage.
 * Keep this provider outside the app tree so the rollout reminder remains isolated.
 */
export function EducationLevelReminderProvider({
  children,
  storage = browserStorage(),
}: EducationLevelReminderProviderProps) {
  const [pending, setPending] = useState(() => {
    if (!storage) return false;
    try {
      return initializeEducationLevelReminder(storage, detectExistingVisitor(storage));
    } catch {
      return false;
    }
  });

  const acknowledge = useCallback(() => {
    if (storage) markEducationLevelReminderSeen(storage);
    setPending(false);
  }, [storage]);

  const value = useMemo(() => ({ pending, acknowledge }), [acknowledge, pending]);
  return (
    <EducationLevelReminderContext.Provider value={value}>
      {children}
    </EducationLevelReminderContext.Provider>
  );
}

export function useEducationLevelReminder(): EducationLevelReminderValue {
  const context = useContext(EducationLevelReminderContext);
  if (!context) {
    throw new Error(
      'useEducationLevelReminder must be used within EducationLevelReminderProvider',
    );
  }
  return context;
}
