import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FavoritesState } from '@/types';
import {
  EMPTY_FAVORITES_STATE,
  favoritesStorageKey,
  loadFavorites,
  saveFavorites,
  toggleFavorite,
  type StorageLike,
} from './favorites';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const allKinds: FavoritesState = {
  version: 1,
  planIds: ['p1'],
  arrangementIds: ['g1||g2'],
  timeGroupKeys: ['MATH::slot'],
  sectionIds: ['MATH.01'],
};

const favoritesContextSource = readFileSync(
  new URL('./FavoritesContext.tsx', import.meta.url),
  'utf8',
);

describe('favorites persistence', () => {
  it('uses a semester-scoped versioned storage key and empty fallback', () => {
    const storage = new MemoryStorage();

    expect(favoritesStorageKey('2026-fall')).toBe('class-arrange:v1:favorites:2026-fall');
    expect(loadFavorites('2026-fall', storage)).toEqual(EMPTY_FAVORITES_STATE);
    expect(loadFavorites('2026-summer', storage)).toEqual(EMPTY_FAVORITES_STATE);
  });

  it('round-trips every favorite kind without leaking across semesters', () => {
    const storage = new MemoryStorage();

    expect(saveFavorites('2026-fall', allKinds, storage)).toBe(true);
    expect(loadFavorites('2026-fall', storage)).toEqual(allKinds);
    expect(loadFavorites('2026-summer', storage)).toEqual(EMPTY_FAVORITES_STATE);
  });

  it('returns a fresh empty state for malformed and unsupported stored payloads', () => {
    const storage = new MemoryStorage();

    storage.setItem(favoritesStorageKey('2026-fall'), '{not JSON');
    const malformed = loadFavorites('2026-fall', storage);
    expect(malformed).toEqual(EMPTY_FAVORITES_STATE);
    expect(malformed).not.toBe(EMPTY_FAVORITES_STATE);

    storage.setItem(favoritesStorageKey('2026-fall'), JSON.stringify({ version: 2 }));
    const unsupported = loadFavorites('2026-fall', storage);
    expect(unsupported).toEqual(EMPTY_FAVORITES_STATE);
    expect(unsupported).not.toBe(EMPTY_FAVORITES_STATE);
  });

  it('normalizes every stored collection to unique non-empty trimmed strings', () => {
    const storage = new MemoryStorage();
    storage.setItem(favoritesStorageKey('2026-fall'), JSON.stringify({
      version: 1,
      planIds: [' p1 ', '', 'p1', 2, null, 'p2'],
      arrangementIds: ['a', 'a', ' ', 'b'],
      timeGroupKeys: undefined,
      sectionIds: 'not-an-array',
    }));

    expect(loadFavorites('2026-fall', storage)).toEqual({
      version: 1,
      planIds: ['p1', 'p2'],
      arrangementIds: ['a', 'b'],
      timeGroupKeys: [],
      sectionIds: [],
    });
  });

  it.each([
    ['plan', 'p2', 'planIds'],
    ['arrangement', 'g3||g4', 'arrangementIds'],
    ['timeGroup', 'PHYS::slot', 'timeGroupKeys'],
    ['section', 'PHYS.02', 'sectionIds'],
  ] as const)('toggles only the requested %s favorite immutably', (kind, id, field) => {
    const original = { ...allKinds, [field]: [...allKinds[field]] };

    const added = toggleFavorite(original, kind, id);
    expect(added[field]).toEqual([...allKinds[field], id]);
    expect(added).not.toBe(original);
    expect(original).toEqual(allKinds);

    const removed = toggleFavorite(added, kind, id);
    expect(removed[field]).toEqual(allKinds[field]);
    expect(removed).not.toBe(added);
    expect(added[field]).toEqual([...allKinds[field], id]);
  });

  it('does not change state for a blank toggle id', () => {
    expect(toggleFavorite(allKinds, 'plan', '  ')).toBe(allKinds);
  });

  it('remounts its state owner when the semester key changes', () => {
    expect(favoritesContextSource).toMatch(
      /export function FavoritesProvider\([\s\S]*?<FavoritesProviderInner key=\{semesterKey\} semesterKey=\{semesterKey\}>/,
    );
    expect(favoritesContextSource).toMatch(
      /function FavoritesProviderInner[\s\S]*?useState<FavoritesState>\(\(\) => loadFavorites\(semesterKey\)\)/,
    );
  });
});
