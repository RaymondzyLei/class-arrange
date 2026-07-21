import { describe, expect, test } from 'vitest';
import {
  EDUCATION_LEVEL_REMINDER_STORAGE_KEY,
  initializeEducationLevelReminder,
  markEducationLevelReminderSeen,
} from './educationLevelReminder';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('education-level reminder persistence', () => {
  test('silently baselines new visitors with the versioned reminder marker', () => {
    const storage = memoryStorage();

    expect(initializeEducationLevelReminder(storage, false)).toBe(false);
    expect(storage.values.get(EDUCATION_LEVEL_REMINDER_STORAGE_KEY)).toBe('seen');
    expect(EDUCATION_LEVEL_REMINDER_STORAGE_KEY).toContain('2026-07-21');
  });

  test('leaves existing visitors pending until they acknowledge the reminder', () => {
    const storage = memoryStorage();

    expect(initializeEducationLevelReminder(storage, true)).toBe(true);
    expect(storage.values.has(EDUCATION_LEVEL_REMINDER_STORAGE_KEY)).toBe(false);

    expect(markEducationLevelReminderSeen(storage)).toBe(true);
    expect(initializeEducationLevelReminder(storage, true)).toBe(false);
  });

  test('does not show the reminder again when its marker already exists', () => {
    const storage = memoryStorage({
      [EDUCATION_LEVEL_REMINDER_STORAGE_KEY]: 'seen',
    });

    expect(initializeEducationLevelReminder(storage, true)).toBe(false);
    expect(initializeEducationLevelReminder(storage, false)).toBe(false);
  });

  test('fails safely when storage is unavailable', () => {
    const storage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };

    expect(initializeEducationLevelReminder(storage, false)).toBe(false);
    expect(initializeEducationLevelReminder(storage, true)).toBe(true);
    expect(markEducationLevelReminderSeen(storage)).toBe(false);
  });
});
