import type {
  ArrangementFavoriteRecord,
  FavoriteKind,
  FavoritesState,
} from '@/types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const EMPTY_FAVORITES_STATE: FavoritesState = {
  version: 1,
  planIds: [],
  arrangementIds: [],
  arrangementRecords: [],
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
    arrangementRecords: [],
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

function normalizeArrangementRecords(
  value: unknown,
  favoriteIds: readonly string[],
): ArrangementFavoriteRecord[] {
  if (!Array.isArray(value)) return [];
  const allowedIds = new Set(favoriteIds);
  const seen = new Set<string>();
  const records: ArrangementFavoriteRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const planId = typeof record.planId === 'string' ? record.planId.trim() : '';
    const key = `${planId}\u0000${id}`;
    if (!id || !planId || !allowedIds.has(id) || seen.has(key)) continue;
    if (
      typeof record.planName !== 'string'
      || !Number.isSafeInteger(record.originalIndex)
      || (record.originalIndex as number) < 0
      || typeof record.courseCount !== 'number'
      || typeof record.totalCredits !== 'number'
      || typeof record.totalHours !== 'number'
      || typeof record.conflictCount !== 'number'
    ) continue;
    seen.add(key);
    records.push({
      id,
      planId,
      planName: record.planName.trim() || '选课方案',
      originalIndex: record.originalIndex as number,
      courseCount: record.courseCount,
      totalCredits: record.totalCredits,
      totalHours: record.totalHours,
      conflictCount: record.conflictCount,
      courseNames: normalizeIds(record.courseNames),
    });
  }
  return records;
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

    const arrangementIds = normalizeIds(stored.arrangementIds);
    return {
      version: 1,
      planIds: normalizeIds(stored.planIds),
      arrangementIds,
      arrangementRecords: normalizeArrangementRecords(stored.arrangementRecords, arrangementIds),
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
    const arrangementIds = normalizeIds(state.arrangementIds);
    target.setItem(favoritesStorageKey(semesterKey), JSON.stringify({
      version: 1,
      planIds: normalizeIds(state.planIds),
      arrangementIds,
      arrangementRecords: normalizeArrangementRecords(state.arrangementRecords, arrangementIds),
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
  const removing = values.includes(normalizedId);
  return {
    ...state,
    [field]: removing
      ? values.filter((value) => value !== normalizedId)
      : [...values, normalizedId],
    ...(kind === 'arrangement' && removing
      ? { arrangementRecords: state.arrangementRecords.filter((record) => record.id !== normalizedId) }
      : {}),
  };
}

export function toggleArrangementFavorite(
  state: FavoritesState,
  record: ArrangementFavoriteRecord,
): FavoritesState {
  const exists = state.arrangementRecords.some(
    (item) => item.id === record.id && item.planId === record.planId,
  );
  const arrangementRecords = exists
    ? state.arrangementRecords.filter(
        (item) => item.id !== record.id || item.planId !== record.planId,
      )
    : [...state.arrangementRecords, record];
  const stillFavorited = arrangementRecords.some((item) => item.id === record.id);
  return {
    ...state,
    arrangementIds: exists && !stillFavorited
      ? state.arrangementIds.filter((id) => id !== record.id)
      : state.arrangementIds.includes(record.id)
        ? state.arrangementIds
        : [...state.arrangementIds, record.id],
    arrangementRecords,
  };
}

export function rememberArrangementFavorites(
  state: FavoritesState,
  records: readonly ArrangementFavoriteRecord[],
): FavoritesState {
  let changed = false;
  const next = [...state.arrangementRecords];
  for (const record of records) {
    if (!state.arrangementIds.includes(record.id)) continue;
    const index = next.findIndex(
      (item) => item.id === record.id && item.planId === record.planId,
    );
    if (index >= 0) continue;
    next.push(record);
    changed = true;
  }
  return changed ? { ...state, arrangementRecords: next } : state;
}
