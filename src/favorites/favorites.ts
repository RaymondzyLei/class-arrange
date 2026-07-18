import type { FavoriteKind, FavoritesState } from '@/types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const EMPTY_FAVORITES_STATE: FavoritesState = {
  version: 1,
  planIds: [],
  arrangementIds: [],
  timeGroupKeys: [],
  sectionIds: [],
};

const FIELD_BY_KIND = {
  plan: 'planIds',
  arrangement: 'arrangementIds',
  timeGroup: 'timeGroupKeys',
  section: 'sectionIds',
} as const satisfies Record<FavoriteKind, keyof FavoritesState>;

function emptyFavoritesState(): FavoritesState {
  return {
    version: 1,
    planIds: [],
    arrangementIds: [],
    timeGroupKeys: [],
    sectionIds: [],
  };
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  });
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function favoritesStorageKey(semesterKey: string): string {
  return `class-arrange:v1:favorites:${semesterKey}`;
}

export function loadFavorites(semesterKey: string, storage?: StorageLike): FavoritesState {
  try {
    const serialized = getStorage(storage)?.getItem(favoritesStorageKey(semesterKey));
    if (!serialized) return emptyFavoritesState();

    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyFavoritesState();
    const stored = parsed as Record<string, unknown>;
    if (stored.version !== 1) return emptyFavoritesState();

    return {
      version: 1,
      planIds: normalizeIds(stored.planIds),
      arrangementIds: normalizeIds(stored.arrangementIds),
      timeGroupKeys: normalizeIds(stored.timeGroupKeys),
      sectionIds: normalizeIds(stored.sectionIds),
    };
  } catch {
    return emptyFavoritesState();
  }
}

export function saveFavorites(
  semesterKey: string,
  state: FavoritesState,
  storage?: StorageLike,
): boolean {
  try {
    const target = getStorage(storage);
    if (!target) return false;
    target.setItem(favoritesStorageKey(semesterKey), JSON.stringify({
      version: 1,
      planIds: normalizeIds(state.planIds),
      arrangementIds: normalizeIds(state.arrangementIds),
      timeGroupKeys: normalizeIds(state.timeGroupKeys),
      sectionIds: normalizeIds(state.sectionIds),
    } satisfies FavoritesState));
    return true;
  } catch {
    return false;
  }
}

export function toggleFavorite(
  state: FavoritesState,
  kind: FavoriteKind,
  id: string,
): FavoritesState {
  const normalizedId = id.trim();
  if (!normalizedId) return state;
  const field = FIELD_BY_KIND[kind];
  const values = state[field] as string[];
  return {
    ...state,
    [field]: values.includes(normalizedId)
      ? values.filter((value) => value !== normalizedId)
      : [...values, normalizedId],
  };
}
