import type {
  CourseImpactEvent,
  SemesterManifest,
  SemesterManifestEntry,
  SemesterUpdateBatch,
  SemesterUpdateFeed,
} from '@/types';
import type { AppRelease } from './appUpdates';

export const AWARENESS_STORAGE_KEY = 'class-arrange:v1:update-awareness';
export const UPDATE_PREFERENCES_KEY = 'class-arrange:v1:update-preferences';

export interface UpdateAwarenessState {
  version: 1;
  appLastSeen: string | null;
  semesterLastSeen: Record<string, string>;
}

export interface UpdatePreferences {
  showUpdatePopup: boolean;
}

export interface SemesterUpdateHistory {
  semester: SemesterManifestEntry;
  entries: SemesterUpdateBatch[];
}

export interface AutomaticNoticeSelection {
  impacts: CourseImpactEvent[];
  appReleases: AppRelease[];
  semesterUpdates: SemesterUpdateHistory[];
  suppressedImpactIds: string[];
}

interface StorageLike {
  length?: number;
  key?(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createInitialAwarenessState(
  existingVisitor: boolean,
  currentAppVersion: string,
  manifest: SemesterManifest,
): UpdateAwarenessState {
  return {
    version: 1,
    appLastSeen: existingVisitor ? null : currentAppVersion,
    semesterLastSeen: existingVisitor
      ? {}
      : Object.fromEntries(manifest.semesters.map((semester) => [semester.key, semester.revision])),
  };
}

export function unseenAppReleases(
  releases: AppRelease[],
  lastSeen: string | null,
): AppRelease[] {
  if (lastSeen === null) return releases;
  const index = releases.findIndex((release) => release.version === lastSeen);
  if (index < 0) return releases;
  return releases.slice(index + 1);
}

export function entriesSinceRevision(
  feed: SemesterUpdateFeed,
  lastSeen: string | null | undefined,
): SemesterUpdateBatch[] {
  if (lastSeen === feed.currentRevision) return [];
  if (!lastSeen) return feed.entries;
  const index = feed.entries.findIndex((entry) => entry.revision === lastSeen);
  if (index >= 0) return feed.entries.slice(index + 1);
  const next = feed.entries.findIndex((entry) => entry.previousRevision === lastSeen);
  return next >= 0 ? feed.entries.slice(next) : feed.entries;
}

export function selectAutomaticNotice(input: {
  showUpdatePopup: boolean;
  impacts: CourseImpactEvent[];
  appReleases: AppRelease[];
  semesterUpdates: SemesterUpdateHistory[];
}): AutomaticNoticeSelection {
  const removed = input.impacts.filter((impact) => impact.kind === 'removed');
  if (!input.showUpdatePopup) {
    return {
      impacts: removed,
      appReleases: [],
      semesterUpdates: [],
      suppressedImpactIds: input.impacts
        .filter((impact) => impact.kind !== 'removed')
        .map((impact) => impact.id),
    };
  }
  return {
    impacts: input.impacts,
    appReleases: input.appReleases,
    semesterUpdates: input.semesterUpdates,
    suppressedImpactIds: [],
  };
}

export function detectExistingVisitor(storage: StorageLike): boolean {
  const knownKeys = [
    'class-arrange:v1:plans',
    'class-arrange:v1:onboarding',
    'onboardingCompleted',
    'class-arrange:v1:theme',
    'class-arrange:v1:custom-settings',
  ];
  if (knownKeys.some((key) => storage.getItem(key) !== null)) return true;
  if (typeof storage.length !== 'number' || typeof storage.key !== 'function') return false;
  for (let index = 0; index < storage.length; index += 1) {
    if (storage.key(index)?.startsWith('class-arrange:v2:plans:')) return true;
  }
  return false;
}

export function readAwarenessState(
  storage: StorageLike,
  existingVisitor: boolean,
  currentAppVersion: string,
  manifest: SemesterManifest,
): UpdateAwarenessState {
  try {
    const raw = storage.getItem(AWARENESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UpdateAwarenessState>;
      if (parsed.version === 1) {
        return {
          version: 1,
          appLastSeen: typeof parsed.appLastSeen === 'string' ? parsed.appLastSeen : null,
          semesterLastSeen: parsed.semesterLastSeen && typeof parsed.semesterLastSeen === 'object'
            ? parsed.semesterLastSeen
            : {},
        };
      }
    }
  } catch {
    // Fall through to a safe baseline.
  }
  return createInitialAwarenessState(existingVisitor, currentAppVersion, manifest);
}

export function saveAwarenessState(storage: StorageLike, state: UpdateAwarenessState): boolean {
  try {
    storage.setItem(AWARENESS_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function readUpdatePreferences(storage: StorageLike): UpdatePreferences {
  try {
    const raw = storage.getItem(UPDATE_PREFERENCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UpdatePreferences>;
      if (typeof parsed.showUpdatePopup === 'boolean') return { showUpdatePopup: parsed.showUpdatePopup };
    }
  } catch {
    // Use the documented default.
  }
  return { showUpdatePopup: true };
}

export function saveUpdatePreferences(storage: StorageLike, preferences: UpdatePreferences): boolean {
  try {
    storage.setItem(UPDATE_PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export async function loadChangedSemesterUpdates(
  manifest: SemesterManifest,
  awareness: UpdateAwarenessState,
  loader: (entry: SemesterManifestEntry) => Promise<SemesterUpdateFeed>,
): Promise<{ feeds: Array<{ semester: SemesterManifestEntry; feed: SemesterUpdateFeed }>; failedSemesterKeys: string[] }> {
  const changed = manifest.semesters.filter(
    (semester) => awareness.semesterLastSeen[semester.key] !== semester.revision,
  );
  const settled = await Promise.allSettled(
    changed.map(async (semester) => ({ semester, feed: await loader(semester) })),
  );
  const feeds = settled
    .filter((result): result is PromiseFulfilledResult<{
      semester: SemesterManifestEntry;
      feed: SemesterUpdateFeed;
    }> => result.status === 'fulfilled')
    .map((result) => result.value);
  const failedSemesterKeys = settled.flatMap((result, index) =>
    result.status === 'rejected' ? [changed[index].key] : []);
  return { feeds, failedSemesterKeys };
}
