import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CourseGroup, CourseSection, SemesterCatalog, SemesterManifest } from '@/types';
import { buildCourseGroups } from '@/utils/courseGroup';
import {
  SEMESTER_SELECTION_KEY,
  SemesterCatalogError,
  loadSemesterCatalog,
  loadSemesterManifest,
  selectInitialSemester,
  type CatalogFetcher,
} from './semesterCatalog';

export interface SemesterFilterOptions {
  departments: string[];
  courseTypes: string[];
  sectionTypes: string[];
  examTypes: string[];
  gradings: string[];
  languages: string[];
}

export interface SemesterCatalogStatus {
  phase: 'loading' | 'ready' | 'switching' | 'error';
  targetSemesterKey: string | null;
  error: string | null;
}

interface SemesterCatalogValue {
  manifest: SemesterManifest;
  catalog: SemesterCatalog;
  courses: CourseSection[];
  courseMap: Map<string, CourseSection>;
  groups: CourseGroup[];
  groupByKey: Map<string, CourseGroup>;
  groupsByCode: Map<string, CourseGroup[]>;
  filterOptions: SemesterFilterOptions;
  status: SemesterCatalogStatus;
  switchSemester: (semesterKey: string) => Promise<boolean>;
}

interface LoadedData {
  manifest: SemesterManifest;
  catalog: SemesterCatalog;
}

const SemesterCatalogContext = createContext<SemesterCatalogValue | null>(null);

function readStoredSemester(): string | null {
  try {
    return localStorage.getItem(SEMESTER_SELECTION_KEY);
  } catch {
    return null;
  }
}

function persistSemester(semesterKey: string): void {
  try {
    localStorage.setItem(SEMESTER_SELECTION_KEY, semesterKey);
  } catch {
    // 隐私模式或禁用存储时，当前会话仍可正常切换。
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function errorMessage(error: unknown, prefix: string): string {
  if (error instanceof SemesterCatalogError) return `${prefix}：${error.message}`;
  return `${prefix}，请稍后重试`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'));
}

function buildFilterOptions(courses: CourseSection[]): SemesterFilterOptions {
  return {
    departments: unique(courses.map((course) => course.department.name)),
    courseTypes: unique(courses.map((course) => course.courseType)),
    sectionTypes: unique(courses.map((course) => course.sectionType)),
    examTypes: unique(courses.map((course) => course.examType)),
    gradings: unique(courses.map((course) => course.grading)),
    languages: unique(courses.map((course) => course.language)),
  };
}

export function SemesterCatalogProvider({
  children,
  fetcher = fetch,
}: {
  children: ReactNode;
  fetcher?: CatalogFetcher;
}) {
  const [data, setData] = useState<LoadedData | null>(null);
  const [status, setStatus] = useState<SemesterCatalogStatus>({
    phase: 'loading',
    targetSemesterKey: null,
    error: null,
  });
  const dataRef = useRef(data);
  const activeRequestRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const controller = new AbortController();
    activeRequestRef.current?.abort();
    activeRequestRef.current = controller;
    const generation = ++requestGenerationRef.current;

    void (async () => {
      try {
        const manifest = await loadSemesterManifest(fetcher, controller.signal);
        const initialKey = selectInitialSemester(manifest, readStoredSemester());
        const entry = manifest.semesters.find((candidate) => candidate.key === initialKey)!;
        const catalog = await loadSemesterCatalog(entry, fetcher, controller.signal);
        if (controller.signal.aborted || generation !== requestGenerationRef.current) return;
        const next = { manifest, catalog };
        dataRef.current = next;
        setData(next);
        persistSemester(catalog.semester.key);
        setStatus({ phase: 'ready', targetSemesterKey: null, error: null });
      } catch (error) {
        if (controller.signal.aborted || generation !== requestGenerationRef.current || isAbort(error)) {
          return;
        }
        setStatus({
          phase: 'error',
          targetSemesterKey: null,
          error: errorMessage(error, '课程数据加载失败'),
        });
      }
    })();

    return () => controller.abort();
  }, [fetcher]);

  const switchSemester = useCallback(
    async (semesterKey: string): Promise<boolean> => {
      const current = dataRef.current;
      if (!current || current.catalog.semester.key === semesterKey) return Boolean(current);
      const entry = current.manifest.semesters.find((candidate) => candidate.key === semesterKey);
      if (!entry) {
        setStatus({
          phase: 'error',
          targetSemesterKey: null,
          error: `无法切换学期：索引中不存在 ${semesterKey}`,
        });
        return false;
      }

      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;
      const generation = ++requestGenerationRef.current;
      setStatus({ phase: 'switching', targetSemesterKey: semesterKey, error: null });

      try {
        const catalog = await loadSemesterCatalog(entry, fetcher, controller.signal);
        if (controller.signal.aborted || generation !== requestGenerationRef.current) return false;
        const next = { manifest: current.manifest, catalog };
        dataRef.current = next;
        setData(next);
        persistSemester(catalog.semester.key);
        setStatus({ phase: 'ready', targetSemesterKey: null, error: null });
        return true;
      } catch (error) {
        if (controller.signal.aborted || generation !== requestGenerationRef.current || isAbort(error)) {
          return false;
        }
        setStatus({
          phase: 'error',
          targetSemesterKey: null,
          error: errorMessage(error, `无法切换到${entry.name}`),
        });
        return false;
      }
    },
    [fetcher],
  );

  const courses = data?.catalog.courses ?? [];
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const groups = useMemo(() => buildCourseGroups(courses), [courses]);
  const groupByKey = useMemo(() => new Map(groups.map((group) => [group.key, group])), [groups]);
  const groupsByCode = useMemo(() => {
    const result = new Map<string, CourseGroup[]>();
    for (const group of groups) {
      const bucket = result.get(group.courseCode);
      if (bucket) bucket.push(group);
      else result.set(group.courseCode, [group]);
    }
    return result;
  }, [groups]);
  const filterOptions = useMemo(() => buildFilterOptions(courses), [courses]);

  const value = useMemo<SemesterCatalogValue | null>(() => {
    if (!data) return null;
    return {
      manifest: data.manifest,
      catalog: data.catalog,
      courses,
      courseMap,
      groups,
      groupByKey,
      groupsByCode,
      filterOptions,
      status,
      switchSemester,
    };
  }, [courseMap, courses, data, filterOptions, groupByKey, groups, groupsByCode, status, switchSemester]);

  if (!value) {
    return (
      <div className="app-data-state" role={status.phase === 'error' ? 'alert' : 'status'}>
        {status.error ?? '正在加载课程数据…'}
      </div>
    );
  }

  return <SemesterCatalogContext.Provider value={value}>{children}</SemesterCatalogContext.Provider>;
}

export function useSemesterCatalog(): SemesterCatalogValue {
  const value = useContext(SemesterCatalogContext);
  if (!value) throw new Error('useSemesterCatalog must be used within SemesterCatalogProvider');
  return value;
}
