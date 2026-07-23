import { describe, expect, it } from 'vitest';
import {
  EMPTY_MEMOS_STATE,
  MEMOS_STORAGE_KEY,
  addNote,
  loadMemos,
  removeNote,
  saveMemos,
  updateNoteText,
  type StorageLike,
} from './memos';
import type { MemosState } from '@/types';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('memos persistence', () => {
  it('uses a global versioned storage key and empty fallback', () => {
    const storage = new MemoryStorage();
    expect(MEMOS_STORAGE_KEY).toBe('class-arrange:v1:memos');
    expect(loadMemos(storage)).toEqual(EMPTY_MEMOS_STATE);
  });

  it('round-trips notes via save/load', () => {
    const storage = new MemoryStorage();
    const state: MemosState = {
      version: 1,
      notes: [{ id: 'n1', text: '选课备注', updatedAt: 1000 }],
    };
    saveMemos(state, storage);
    expect(loadMemos(storage)).toEqual(state);
  });

  it('drops malformed entries without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      MEMOS_STORAGE_KEY,
      JSON.stringify({ version: 1, notes: [{ id: 'x' }, 'bad', { text: 'no id' }] }),
    );
    expect(loadMemos(storage)).toEqual({ version: 1, notes: [] });
  });

  it('returns empty state on wrong version / bad json', () => {
    const storage = new MemoryStorage();
    storage.setItem(MEMOS_STORAGE_KEY, JSON.stringify({ version: 2, notes: [] }));
    expect(loadMemos(storage)).toEqual(EMPTY_MEMOS_STATE);
    storage.setItem(MEMOS_STORAGE_KEY, 'not json');
    expect(loadMemos(storage)).toEqual(EMPTY_MEMOS_STATE);
  });
});

describe('memos reducers', () => {
  const base: MemosState = { version: 1, notes: [{ id: 'n1', text: 'a', updatedAt: 1 }] };

  it('addNote prepends new notes and dedupes by id', () => {
    const next = addNote(base, { id: 'n2', text: 'b', updatedAt: 2 });
    expect(next.notes.map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(addNote(next, { id: 'n2', text: 'dup', updatedAt: 3 })).toBe(next);
  });

  it('addNote ignores empty id', () => {
    expect(addNote(base, { id: '', text: 'x', updatedAt: 2 })).toBe(base);
  });

  it('updateNoteText updates text and updatedAt', () => {
    const next = updateNoteText(base, 'n1', 'changed', 9);
    expect(next.notes[0]).toEqual({ id: 'n1', text: 'changed', updatedAt: 9 });
    expect(updateNoteText(base, 'missing', 'x', 9)).toBe(base);
  });

  it('removeNote removes by id', () => {
    const next = removeNote(base, 'n1');
    expect(next.notes).toEqual([]);
    expect(removeNote(next, 'n1')).toBe(next);
  });
});
