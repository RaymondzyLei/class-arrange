export const EDUCATION_LEVEL_REMINDER_STORAGE_KEY =
  'class-arrange:v1:education-level-reminder:2026-07-21';

export interface EducationLevelReminderStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Establishes the rollout state without depending on browser globals.
 * Existing visitors remain pending; new visitors are silently baselined.
 */
export function initializeEducationLevelReminder(
  storage: EducationLevelReminderStorage,
  existingVisitor: boolean,
): boolean {
  try {
    if (storage.getItem(EDUCATION_LEVEL_REMINDER_STORAGE_KEY) !== null) return false;
  } catch {
    // Continue with the visitor classification when storage cannot be read.
  }

  if (existingVisitor) return true;
  markEducationLevelReminderSeen(storage);
  return false;
}

export function markEducationLevelReminderSeen(
  storage: EducationLevelReminderStorage,
): boolean {
  try {
    storage.setItem(EDUCATION_LEVEL_REMINDER_STORAGE_KEY, 'seen');
    return true;
  } catch {
    return false;
  }
}
