// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemosProvider, useMemos, type MemosContextValue } from './MemosContext';

let captured: MemosContextValue | null = null;
function Consumer() {
  captured = useMemos();
  return null;
}

async function mount(node: ReactNode): Promise<void> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  localStorage.clear();
  captured = null;
});

describe('MemosContext', () => {
  it('addNote / updateNote / removeNote mutate notes', async () => {
    await mount(createElement(MemosProvider, null, createElement(Consumer)));
    expect(captured!.notes).toEqual([]);

    await act(async () => {
      captured!.addNote('hello');
    });
    expect(captured!.notes).toHaveLength(1);
    expect(captured!.notes[0].text).toBe('hello');
    const id = captured!.notes[0].id;

    await act(async () => {
      captured!.updateNote(id, 'world');
    });
    expect(captured!.notes[0].text).toBe('world');

    await act(async () => {
      captured!.removeNote(id);
    });
    expect(captured!.notes).toHaveLength(0);
  });

  it('persists across remount via localStorage', async () => {
    await mount(createElement(MemosProvider, null, createElement(Consumer)));
    await act(async () => {
      captured!.addNote('persisted');
    });
    captured = null;

    await mount(createElement(MemosProvider, null, createElement(Consumer)));
    expect(captured!.notes.some((n) => n.text === 'persisted')).toBe(true);
  });
});
