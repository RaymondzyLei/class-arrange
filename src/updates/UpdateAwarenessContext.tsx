import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CourseImpactEvent } from '@/types';
import { useSemesterCatalog } from '@/data/SemesterCatalogContext';
import { loadSemesterUpdates } from '@/data/semesterCatalog';
import {
  loadPlansPayload,
  savePlansPayload,
} from '@/utils/planSeed';
import {
  acknowledgeImpacts,
  reconcilePlansWithCatalog,
  reconcilePlansWithUpdates,
} from './planReconciliation';
import { APP_RELEASES, CURRENT_APP_VERSION, type AppRelease } from './appUpdates';
import {
  detectExistingVisitor,
  entriesSinceRevision,
  loadChangedSemesterUpdates,
  readAwarenessState,
  readUpdatePreferences,
  saveAwarenessState,
  saveUpdatePreferences,
  selectAutomaticNotice,
  type AutomaticNoticeSelection,
  type SemesterUpdateHistory,
  type UpdateAwarenessState,
  type UpdatePreferences,
} from './updateAwareness';

interface UpdateHistoryState {
  appReleases: AppRelease[];
  impacts: CourseImpactEvent[];
  semesters: SemesterUpdateHistory[];
  loading: boolean;
  failedSemesterKeys: string[];
}

interface UpdateAwarenessValue {
  ready: boolean;
  preferences: UpdatePreferences;
  automaticNotice: AutomaticNoticeSelection | null;
  history: UpdateHistoryState;
  setShowUpdatePopup: (show: boolean) => void;
  acknowledgeAutomaticNotice: () => void;
  loadFullHistory: () => Promise<void>;
}

const EMPTY_NOTICE: AutomaticNoticeSelection = {
  impacts: [],
  appReleases: [],
  semesterUpdates: [],
  suppressedImpactIds: [],
};

function hasNoticeContent(notice: AutomaticNoticeSelection): boolean {
  return notice.impacts.length > 0
    || notice.appReleases.length > 0
    || notice.semesterUpdates.some((semester) => semester.entries.length > 0);
}

const UpdateAwarenessContext = createContext<UpdateAwarenessValue | null>(null);

export function UpdateAwarenessProvider({ children }: { children: ReactNode }) {
  const { manifest, catalog, courseMap } = useSemesterCatalog();
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<UpdatePreferences>({ showUpdatePopup: true });
  const [automaticNotice, setAutomaticNotice] = useState<AutomaticNoticeSelection | null>(null);
  const [awareness, setAwareness] = useState<UpdateAwarenessState | null>(null);
  const [successfulRevisions, setSuccessfulRevisions] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<UpdateHistoryState>({
    appReleases: APP_RELEASES,
    impacts: [],
    semesters: [],
    loading: false,
    failedSemesterKeys: [],
  });

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      const storage = window.localStorage;
      const existingVisitor = detectExistingVisitor(storage);
      let nextAwareness = readAwarenessState(
        storage,
        existingVisitor,
        CURRENT_APP_VERSION,
        manifest,
      );
      saveAwarenessState(storage, nextAwareness);
      const nextPreferences = readUpdatePreferences(storage);
      const loaded = await loadChangedSemesterUpdates(manifest, nextAwareness, loadSemesterUpdates);
      if (cancelled) return;

      const revisions: Record<string, string> = {};
      const semesterUpdates: SemesterUpdateHistory[] = [];
      for (const { semester, feed } of loaded.feeds) {
        revisions[semester.key] = semester.revision;
        semesterUpdates.push({
          semester,
          entries: entriesSinceRevision(feed, nextAwareness.semesterLastSeen[semester.key]),
        });
        const stored = loadPlansPayload(semester.key, {
          defaultSemester: manifest.defaultSemester,
        });
        if (stored) {
          savePlansPayload(
            semester.key,
            reconcilePlansWithUpdates(
              stored,
              semester.key,
              semester.revision,
              feed.entries,
            ),
          );
        }
      }

      const activeStored = loadPlansPayload(catalog.semester.key, {
        defaultSemester: manifest.defaultSemester,
      });
      if (activeStored) {
        savePlansPayload(
          catalog.semester.key,
          reconcilePlansWithCatalog(
            activeStored,
            catalog.semester.key,
            catalog.revision,
            courseMap,
          ),
        );
      }

      const storedPayloads = manifest.semesters.flatMap((semester) => {
        const stored = loadPlansPayload(semester.key, { defaultSemester: manifest.defaultSemester });
        return stored ? [stored] : [];
      });
      const impacts = storedPayloads.flatMap((stored) => stored.pendingImpacts);
      const impactHistory = storedPayloads.flatMap((stored) => stored.impactHistory);
      const notice = selectAutomaticNotice({
        showUpdatePopup: nextPreferences.showUpdatePopup,
        impacts,
        appReleases: APP_RELEASES.filter((release) => {
          if (nextAwareness.appLastSeen === null) return true;
          const seenIndex = APP_RELEASES.findIndex((item) => item.version === nextAwareness.appLastSeen);
          return seenIndex < 0 || APP_RELEASES.indexOf(release) > seenIndex;
        }),
        semesterUpdates,
      });

      if (notice.suppressedImpactIds.length > 0) {
        for (const semester of manifest.semesters) {
          const stored = loadPlansPayload(semester.key, { defaultSemester: manifest.defaultSemester });
          if (stored) {
            savePlansPayload(
              semester.key,
              acknowledgeImpacts(stored, notice.suppressedImpactIds),
            );
          }
        }
      }

      if (!nextPreferences.showUpdatePopup) {
        nextAwareness = {
          ...nextAwareness,
          appLastSeen: CURRENT_APP_VERSION,
          semesterLastSeen: { ...nextAwareness.semesterLastSeen, ...revisions },
        };
        saveAwarenessState(storage, nextAwareness);
      } else if (!hasNoticeContent(notice)) {
        nextAwareness = {
          ...nextAwareness,
          semesterLastSeen: { ...nextAwareness.semesterLastSeen, ...revisions },
        };
        saveAwarenessState(storage, nextAwareness);
      }

      setPreferences(nextPreferences);
      setAwareness(nextAwareness);
      setSuccessfulRevisions(revisions);
      setAutomaticNotice(hasNoticeContent(notice) ? notice : null);
      setHistory((current) => ({
        ...current,
        impacts: impactHistory,
        semesters: semesterUpdates,
      }));
      setReady(true);
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [catalog.revision, catalog.semester.key, courseMap, manifest]);

  const setShowUpdatePopup = useCallback((showUpdatePopup: boolean) => {
    const next = { showUpdatePopup };
    setPreferences(next);
    saveUpdatePreferences(window.localStorage, next);
  }, []);

  const acknowledgeAutomaticNotice = useCallback(() => {
    if (!automaticNotice || !awareness) return;
    const impactIds = automaticNotice.impacts.map((impact) => impact.id);
    for (const semester of manifest.semesters) {
      const stored = loadPlansPayload(semester.key, { defaultSemester: manifest.defaultSemester });
      if (stored) savePlansPayload(semester.key, acknowledgeImpacts(stored, impactIds));
    }
    const next: UpdateAwarenessState = {
      ...awareness,
      appLastSeen: automaticNotice.appReleases.length > 0
        ? CURRENT_APP_VERSION
        : awareness.appLastSeen,
      semesterLastSeen: {
        ...awareness.semesterLastSeen,
        ...successfulRevisions,
      },
    };
    saveAwarenessState(window.localStorage, next);
    setAwareness(next);
    setAutomaticNotice(null);
  }, [automaticNotice, awareness, manifest, successfulRevisions]);

  const loadFullHistory = useCallback(async () => {
    setHistory((current) => ({ ...current, loading: true, failedSemesterKeys: [] }));
    const settled = await Promise.allSettled(
      manifest.semesters.map(async (semester) => ({
        semester,
        feed: await loadSemesterUpdates(semester),
      })),
    );
    const semesters = settled.flatMap((result) => result.status === 'fulfilled'
      ? [{ semester: result.value.semester, entries: result.value.feed.entries }]
      : []);
    const failedSemesterKeys = settled.flatMap((result, index) => result.status === 'rejected'
      ? [manifest.semesters[index].key]
      : []);
    setHistory({
      appReleases: APP_RELEASES,
      impacts: manifest.semesters.flatMap((semester) =>
        loadPlansPayload(semester.key, { defaultSemester: manifest.defaultSemester })
          ?.impactHistory ?? []),
      semesters,
      loading: false,
      failedSemesterKeys,
    });
  }, [manifest]);

  const value = useMemo<UpdateAwarenessValue>(() => ({
    ready,
    preferences,
    automaticNotice: automaticNotice ?? (ready ? null : EMPTY_NOTICE),
    history,
    setShowUpdatePopup,
    acknowledgeAutomaticNotice,
    loadFullHistory,
  }), [
    acknowledgeAutomaticNotice,
    automaticNotice,
    history,
    loadFullHistory,
    preferences,
    ready,
    setShowUpdatePopup,
  ]);

  return (
    <UpdateAwarenessContext.Provider value={value}>
      {ready ? children : null}
    </UpdateAwarenessContext.Provider>
  );
}

export function useUpdateAwareness(): UpdateAwarenessValue {
  const context = useContext(UpdateAwarenessContext);
  if (!context) throw new Error('useUpdateAwareness must be used within UpdateAwarenessProvider');
  return context;
}
