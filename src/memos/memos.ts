import type { MemoNote, MemosState } from '@/types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const EMPTY_MEMOS_STATE: MemosState = { version: 1, notes: [] };

export const MEMOS_STORAGE_KEY = 'class-arrange:v1:memos';

function emptyMemosState(): MemosState {
  return { version: 1, notes: [] };
}

function normalizeNotes(value: unknown): MemoNote[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const notes: MemoNote[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.text !== 'string') continue;
    const id = record.id.trim();
    if (!id || seen.has(id)) continue;
    const updatedAt =
      typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : 0;
    seen.add(id);
    notes.push({ id, text: record.text, updatedAt });
  }
  return notes;
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function loadMemos(storage?: StorageLike): MemosState {
  try {
    const serialized = getStorage(storage)?.getItem(MEMOS_STORAGE_KEY);
    if (!serialized) return emptyMemosState();
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyMemosState();
    const stored = parsed as Record<string, unknown>;
    if (stored.version !== 1) return emptyMemosState();
    return { version: 1, notes: normalizeNotes(stored.notes) };
  } catch {
    return emptyMemosState();
  }
}

export function saveMemos(state: MemosState, storage?: StorageLike): boolean {
  try {
    const target = getStorage(storage);
    if (!target) return false;
    target.setItem(
      MEMOS_STORAGE_KEY,
      JSON.stringify({ version: 1, notes: normalizeNotes(state.notes) } satisfies MemosState),
    );
    return true;
  } catch {
    return false;
  }
}

export function addNote(state: MemosState, note: MemoNote): MemosState {
  if (!note.id) return state;
  if (state.notes.some((item) => item.id === note.id)) return state;
  return { ...state, notes: [{ ...note }, ...state.notes] };
}

export function updateNoteText(
  state: MemosState,
  id: string,
  text: string,
  now: number,
): MemosState {
  const normalizedId = id.trim();
  if (!normalizedId) return state;
  let changed = false;
  const notes = state.notes.map((item) => {
    if (item.id !== normalizedId) return item;
    changed = true;
    return { ...item, text, updatedAt: now };
  });
  return changed ? { ...state, notes } : state;
}

export function removeNote(state: MemosState, id: string): MemosState {
  const normalizedId = id.trim();
  if (!normalizedId) return state;
  if (!state.notes.some((item) => item.id === normalizedId)) return state;
  return { ...state, notes: state.notes.filter((item) => item.id !== normalizedId) };
}
