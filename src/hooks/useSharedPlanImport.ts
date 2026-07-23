import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CourseSection,
  Plan,
  PlansState,
  SemesterManifest,
} from '@/types';
import type { PlansAction } from '@/store/plansReducer';
import {
  clearSharedPlanFragment,
  hasReusableSingleEmptyPlan,
  parseSharedPlanFragment,
  resolveImportedPlanName,
  type SharedPlanPayload,
} from '@/utils/sharedPlan';

export interface SharedPlanPreview {
  payload: SharedPlanPayload;
  importName: string;
  validCourses: CourseSection[];
  missingCourseIds: string[];
  reusesEmptyPlan: boolean;
  canImport: boolean;
  blockReason: string | null;
}

export type SharedPlanImportState =
  | { kind: 'closed' }
  | { kind: 'switching'; semesterName: string }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; semesterName: string; preview: SharedPlanPreview };

interface UseSharedPlanImportOptions {
  manifest: SemesterManifest;
  currentSemesterKey: string;
  courseMap: ReadonlyMap<string, CourseSection>;
  plansState: PlansState;
  dispatch: React.Dispatch<PlansAction>;
  switchSemester: (semesterKey: string) => Promise<boolean>;
}

export function deriveSharedPlanPreview(
  payload: SharedPlanPayload,
  courseMap: ReadonlyMap<string, CourseSection>,
  plans: Plan[],
): SharedPlanPreview {
  const validCourses: CourseSection[] = [];
  const missingCourseIds: string[] = [];
  for (const courseId of payload.courseIds) {
    const course = courseMap.get(courseId);
    if (course) validCourses.push(course);
    else missingCourseIds.push(courseId);
  }

  const reusesEmptyPlan = hasReusableSingleEmptyPlan(plans);
  const retainedPlans = reusesEmptyPlan ? [] : plans;
  const importName = resolveImportedPlanName(payload.name, retainedPlans);
  let blockReason: string | null = null;
  if (validCourses.length === 0) {
    blockReason = '分享方案中的课堂已全部失效，无法导入。';
  } else if (!reusesEmptyPlan && plans.length >= 10) {
    blockReason = '当前学期已经有 10 个方案，请先删除一个方案再导入。';
  }

  return {
    payload,
    importName,
    validCourses,
    missingCourseIds,
    reusesEmptyPlan,
    canImport: blockReason === null,
    blockReason,
  };
}

export function useSharedPlanImport({
  manifest,
  currentSemesterKey,
  courseMap,
  plansState,
  dispatch,
  switchSemester,
}: UseSharedPlanImportOptions) {
  const [fragment, setFragment] = useState(
    () => typeof window === 'undefined' ? '' : window.location.hash,
  );
  const [state, setState] = useState<SharedPlanImportState>({ kind: 'closed' });
  const switchRequestRef = useRef<string | null>(null);
  const parsed = useMemo(() => parseSharedPlanFragment(fragment), [fragment]);

  useEffect(() => {
    const handleHashChange = () => setFragment(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (parsed.kind === 'none') {
      setState({ kind: 'closed' });
      switchRequestRef.current = null;
      return;
    }
    if (parsed.kind === 'error') {
      setState({ kind: 'error', message: parsed.message });
      switchRequestRef.current = null;
      return;
    }

    const semester = manifest.semesters.find(
      (entry) => entry.key === parsed.payload.semesterKey,
    );
    if (!semester) {
      setState({ kind: 'error', message: '分享方案所属学期已不可用。' });
      switchRequestRef.current = null;
      return;
    }

    if (currentSemesterKey !== parsed.payload.semesterKey) {
      setState({ kind: 'switching', semesterName: semester.name });
      const requestKey = `${fragment}:${currentSemesterKey}`;
      if (switchRequestRef.current !== requestKey) {
        switchRequestRef.current = requestKey;
        void switchSemester(parsed.payload.semesterKey).then((succeeded) => {
          if (!succeeded && window.location.hash === fragment) {
            setState({ kind: 'error', message: `无法加载${semester.name}的课程目录。` });
          }
        });
      }
      return;
    }

    switchRequestRef.current = null;
    setState({
      kind: 'preview',
      semesterName: semester.name,
      preview: deriveSharedPlanPreview(parsed.payload, courseMap, plansState.plans),
    });
  }, [
    courseMap,
    currentSemesterKey,
    fragment,
    manifest.semesters,
    parsed,
    plansState.plans,
    switchSemester,
  ]);

  const closeImport = useCallback(() => {
    clearSharedPlanFragment();
    setFragment('');
    setState({ kind: 'closed' });
    switchRequestRef.current = null;
  }, []);

  const confirmImport = useCallback((): string | null => {
    if (state.kind !== 'preview' || !state.preview.canImport) return null;
    dispatch({
      type: 'importPlan',
      name: state.preview.importName,
      courseIds: state.preview.validCourses.map((course) => course.id),
    });
    const importedName = state.preview.importName;
    closeImport();
    return importedName;
  }, [closeImport, dispatch, state]);

  return {
    state,
    closeImport,
    confirmImport,
  };
}
