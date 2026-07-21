import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { EDUCATION_LEVEL_REMINDER_STORAGE_KEY } from './educationLevelReminder';
import {
  EducationLevelReminderProvider,
  useEducationLevelReminder,
} from './EducationLevelReminderContext';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function Probe() {
  const reminder = useEducationLevelReminder();
  return createElement('output', null, reminder.pending ? 'pending' : 'baseline');
}

function SynchronousPlansProvider({ children, storage }: {
  children: ReactNode;
  storage: ReturnType<typeof memoryStorage>;
}) {
  storage.setItem('class-arrange:v2:plans:2026-fall', '{}');
  return children;
}

describe('EducationLevelReminderProvider', () => {
  test('classifies a new visitor before a nested plans provider creates storage', () => {
    const storage = memoryStorage();
    const html = renderToStaticMarkup(createElement(
      EducationLevelReminderProvider,
      {
        storage,
        children: createElement(
        SynchronousPlansProvider,
          { storage, children: createElement(Probe) },
        ),
      },
    ));

    expect(html).toContain('baseline');
    expect(storage.getItem(EDUCATION_LEVEL_REMINDER_STORAGE_KEY)).toBe('seen');
  });

  test('keeps a pre-existing visitor pending', () => {
    const storage = memoryStorage({ 'class-arrange:v2:plans:2026-fall': '{}' });
    const html = renderToStaticMarkup(createElement(EducationLevelReminderProvider, {
      storage,
      children: createElement(Probe),
    }));

    expect(html).toContain('pending');
    expect(storage.getItem(EDUCATION_LEVEL_REMINDER_STORAGE_KEY)).toBeNull();
  });
});
