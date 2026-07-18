import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ConfigProvider, Layout, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PlansProvider, usePlans } from '@/store/plansContext';
import { computeStats } from '@/utils/stats';
import { buildCourseGroups, mergeCourseTimeGroups } from '@/utils/courseGroup';
import { useSemesterCatalog } from '@/data/SemesterCatalogContext';
import { pickDefaultArrangement } from '@/utils/arrangement';
import type {
  Arrangement,
  CourseGroup,
  CourseImpactEvent,
  FilterState,
  SelectedCourseSnapshot,
} from '@/types';
import PlanSwitcher from '@/components/PlanSwitcher';
import FilterBar from '@/components/FilterBar';
import CoursePool from '@/components/CoursePool';
import CourseTable from '@/components/CourseTable';
import StatsBar from '@/components/StatsBar';
import ArrangementPanel from '@/components/ArrangementPanel';
import CalculationStatus from '@/components/CalculationStatus';
import CourseDetailModal from '@/components/CourseDetailModal';
import SelectedCoursesModal from '@/components/SelectedCoursesModal';
import FavoritesManagerModal, { type FavoriteManagerItem } from '@/components/FavoritesManagerModal';
import CustomizationModal, { type CustomizationPage } from '@/components/CustomizationModal';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import SpotlightTour from '@/components/onboarding/SpotlightTour';
import { useConflicts } from '@/hooks/useConflicts';
import { useFilteredCourses } from '@/hooks/useFilteredCourses';
import { useArrangementCalculation } from '@/hooks/useArrangementCalculation';
import {
  readOnboardingState,
  useOnboarding,
  type OnboardingPreferences,
} from '@/onboarding/useOnboarding';
import type { TourStep } from '@/onboarding/tourSteps';
import { exportTimetableImage } from '@/utils/exportPrint';
import {
  curriculumOptions,
  getCurriculum,
  getDefaultCurriculumTerm,
  isValidCurriculumTerm,
} from '@/utils/curriculum';
import type { WeekSelection } from '@/config/termCalendar';
import { getWeekLabel } from '@/config/termCalendar';
import {
  readCustomScheduleSettings,
  saveCustomScheduleSettings,
  type CustomScheduleSettings,
} from '@/utils/customization';
import {
  pendingFavoriteArrangementAction,
  resolveSelectedArrangementId,
} from '@/utils/arrangementCalculationState';
import { useUpdateAwareness } from '@/updates/UpdateAwarenessContext';
import UpdateNoticeModal from '@/components/UpdateNoticeModal';
import UpdateHistoryModal from '@/components/UpdateHistoryModal';
import { loadPlansPayload, savePlansPayload } from '@/utils/planSeed';
import { FavoritesProvider, useFavorites } from '@/favorites/FavoritesContext';
import {
  activeArrangementFavoritePreferences,
  activeArrangementFavoriteIds,
  arrangementNumbersById,
  createArrangementFavoriteRecord,
} from '@/utils/arrangementFavorites';

const EMPTY_FILTER: FilterState = {
  keyword: '',
  includeTeacher: false,
  department: '',
  courseType: '',
  sectionType: '',
  examType: '',
  grading: '',
  language: '',
};

const EMPTY_IDS: Set<string> = new Set();
const EMPTY_GROUPS: CourseGroup[] = [];
const EMPTY_ARRANGEMENTS: Arrangement[] = [];
const EMPTY_BLOCKED_SLOTS: string[] = [];
const THEME_KEY = 'class-arrange:v1:theme';
const CURRICULUM_SELECTION_KEY = 'class-arrange:v1:curriculum-selection';
type Theme = 'light' | 'dark';

interface CurriculumSelection {
  curriculumId: string | null;
  term: string | null;
}

// 深色模式优化：让 Ant Design 控件、下拉层和表格与页面的炭黑层级保持一致。
const DARK_ANTD_THEME_TOKENS = {
  colorPrimary: '#8b9fe8',
  colorInfo: '#8b9fe8',
  colorSuccess: '#80c69d',
  colorWarning: '#e9b85b',
  colorError: '#ef7e86',
  colorBgBase: '#15191f',
  colorBgLayout: '#15191f',
  colorBgContainer: '#191e25',
  colorBgElevated: '#232a34',
  colorFill: 'rgba(255, 255, 255, 0.10)',
  colorFillSecondary: 'rgba(255, 255, 255, 0.07)',
  colorFillTertiary: 'rgba(255, 255, 255, 0.05)',
  colorFillQuaternary: 'rgba(255, 255, 255, 0.03)',
  colorText: '#edf1f5',
  colorTextSecondary: '#b7c0cc',
  colorTextTertiary: '#828e9d',
  colorTextQuaternary: '#687585',
  colorTextPlaceholder: '#7b8796',
  colorBorder: '#394451',
  colorBorderSecondary: '#313a46',
  colorSplit: '#313a46',
  controlItemBgHover: 'rgba(255, 255, 255, 0.06)',
  controlItemBgActive: '#2b354d',
  controlItemBgActiveHover: '#34415c',
  controlOutline: 'rgba(139, 159, 232, 0.34)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.34)',
  boxShadowSecondary: '0 14px 38px rgba(0, 0, 0, 0.42)',
} as const;

function readInitialTheme(): Theme {
  if (!readOnboardingState().wizardCompleted) return 'light';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // 隐私模式
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function readInitialCurriculumSelection(): CurriculumSelection {
  try {
    const raw = localStorage.getItem(CURRICULUM_SELECTION_KEY);
    if (!raw) return { curriculumId: null, term: null };
    const parsed = JSON.parse(raw) as Partial<CurriculumSelection>;
    const curriculumId = typeof parsed.curriculumId === 'string' ? parsed.curriculumId : null;
    if (!getCurriculum(curriculumId)) return { curriculumId: null, term: null };
    const storedTerm = typeof parsed.term === 'string' ? parsed.term : null;
    const term = isValidCurriculumTerm(curriculumId, storedTerm)
      ? storedTerm
      : getDefaultCurriculumTerm(curriculumId);
    return { curriculumId, term };
  } catch {
    return { curriculumId: null, term: null };
  }
}

function MainArea({ themeMode, onToggleTheme }: { themeMode: Theme; onToggleTheme: () => void }) {
  const { state: plansState, activePlan, dispatch } = usePlans();
  const favoriteState = useFavorites();
  const updateAwareness = useUpdateAwareness();
  const {
    manifest,
    catalog,
    courses,
    courseMap,
    groups,
    groupByKey,
    groupsByCode,
    filterOptions,
    status: catalogStatus,
    switchSemester,
  } = useSemesterCatalog();
  const { message } = AntApp.useApp();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [weekSelection, setWeekSelection] = useState<WeekSelection>('all');
  const [detailGroupKey, setDetailGroupKey] = useState<string | null>(null);
  const [arrangementView, setArrangementView] = useState<'recommended' | 'conflict-free'>('recommended');
  const [recommendedArrangementSelection, setRecommendedArrangementSelection] = useState<{
    inputKey: string | null;
    id: string | null;
  }>({ inputKey: null, id: null });
  const [conflictFreeArrangementSelection, setConflictFreeArrangementSelection] = useState<{
    inputKey: string | null;
    id: string | null;
  }>({ inputKey: null, id: null });
  const [selectedCoursesOpen, setSelectedCoursesOpen] = useState(false);
  const [selectedCoursesTab, setSelectedCoursesTab] = useState<'current' | 'curriculum'>('current');
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [pendingFavoriteArrangement, setPendingFavoriteArrangement] = useState<{
    planId: string;
    arrangementId: string;
  } | null>(null);
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [customizationInitialPage, setCustomizationInitialPage] = useState<CustomizationPage>('main');
  const [updateHistoryOpen, setUpdateHistoryOpen] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomScheduleSettings>(
    readCustomScheduleSettings,
  );
  const onboarding = useOnboarding();
  const [automaticNoticeOpen, setAutomaticNoticeOpen] = useState(false);
  const [curriculumSelection, setCurriculumSelection] = useState<CurriculumSelection>(readInitialCurriculumSelection);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const mergedGroups = useMemo(() => mergeCourseTimeGroups(groups), [groups]);
  const mergedGroupByKey = useMemo(
    () => new Map(mergedGroups.map((group) => [group.key, group])),
    [mergedGroups],
  );
  const mergedGroupByCode = useMemo(
    () => new Map(mergedGroups.map((group) => [group.courseCode, group])),
    [mergedGroups],
  );
  const sectionGroupKeyById = useMemo(() => {
    const result = new Map<string, string>();
    groups.forEach((group) => {
      group.sectionIds.forEach((sectionId) => result.set(sectionId, group.key));
    });
    return result;
  }, [groups]);
  const filteredGroups = useFilteredCourses(
    courses,
    groups,
    filter,
    customSettings.mergeAllTimeGroups,
  );

  useEffect(() => {
    if (!updateAwareness.automaticNotice || onboarding.stage !== 'hidden') {
      setAutomaticNoticeOpen(false);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => setAutomaticNoticeOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [onboarding.stage, updateAwareness.automaticNotice]);

  // 已选 sections → CourseGroup[]（按 groupKey 聚合）
  const allSelectedGroups = useMemo<CourseGroup[]>(() => {
    if (!activePlan) return [];
    const sections = activePlan.courseIds
      .map((id) => courseMap.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return buildCourseGroups(sections);
  }, [activePlan, courseMap]);

  // 已选 stable Set
  const selectedIds = useMemo<Set<string>>(
    () => (activePlan ? new Set(activePlan.courseIds) : EMPTY_IDS),
    [activePlan],
  );

  const activeArrangementFavoriteIdList = useMemo(
    () => activeArrangementFavoriteIds(
      favoriteState.state.arrangementIds,
      favoriteState.state.arrangementRecords,
      activePlan?.id,
    ),
    [activePlan?.id, favoriteState.state.arrangementIds, favoriteState.state.arrangementRecords],
  );
  const activeArrangementFavoriteIdSet = useMemo(
    () => new Set(activeArrangementFavoriteIdList),
    [activeArrangementFavoriteIdList],
  );
  const activeArrangementPreferences = useMemo(() => (
    activeArrangementFavoritePreferences(
      activeArrangementFavoriteIdList,
      favoriteState.state.timeGroupKeys,
      favoriteState.state.sectionIds,
      allSelectedGroups,
    )
  ), [
    activeArrangementFavoriteIdList,
    allSelectedGroups,
    favoriteState.state.sectionIds,
    favoriteState.state.timeGroupKeys,
  ]);

  const calculation = useArrangementCalculation({
    scopeKey: `${catalog.semester.key}:${activePlan?.id ?? 'no-plan'}`,
    groups: allSelectedGroups,
    settings: customSettings,
    favorites: activeArrangementPreferences,
  });
  const recommendedArrangements = calculation.committed?.arrangements ?? EMPTY_ARRANGEMENTS;
  const conflictFreeArrangements = calculation.allConflictFreePhase === 'ready'
    ? calculation.allConflictFreeArrangements
    : calculation.committed?.conflictFreePreview ?? EMPTY_ARRANGEMENTS;
  const arrangements = arrangementView === 'recommended'
    ? recommendedArrangements
    : conflictFreeArrangements;
  const arrangementNumbers = useMemo(
    () => arrangementNumbersById(
      arrangements,
      favoriteState.state.arrangementRecords,
      activePlan?.id,
    ),
    [activePlan?.id, arrangements, favoriteState.state.arrangementRecords],
  );
  const committedArrangementInputKey = calculation.committed?.inputKey ?? null;
  const activeArrangementSelection = arrangementView === 'recommended'
    ? recommendedArrangementSelection
    : conflictFreeArrangementSelection;
  const selectedArrangementId = activeArrangementSelection.inputKey === committedArrangementInputKey
    ? activeArrangementSelection.id
    : null;

  // 用户选择有效 → 应用之；否则用默认（最低冲突）
  const appliedArrangement: Arrangement | null = useMemo(() => {
    if (arrangements.length === 0) return null;
    if (selectedArrangementId) {
      const found = arrangements.find((a) => a.id === selectedArrangementId);
      if (found) return found;
    }
    return pickDefaultArrangement(arrangements);
  }, [arrangements, selectedArrangementId]);

  const appliedGroups = appliedArrangement?.groups ?? EMPTY_GROUPS;
  const committedBlockedSlots = calculation.committed?.settings.blockedSlots
    ?? EMPTY_BLOCKED_SLOTS;

  const { conflictGroupKeys } = useConflicts(appliedGroups, committedBlockedSlots);

  const stats = useMemo(
    () => computeStats(appliedGroups, conflictGroupKeys),
    [appliedGroups, conflictGroupKeys],
  );

  const favoriteItems = useMemo<FavoriteManagerItem[]>(() => {
    const arrangementById = new Map(
      [...recommendedArrangements, ...conflictFreeArrangements]
        .map((arrangement) => [arrangement.id, arrangement] as const),
    );
    const items: FavoriteManagerItem[] = [];

    favoriteState.state.planIds.forEach((id) => {
      const plan = plansState.plans.find((item) => item.id === id);
      items.push({
        kind: 'plan',
        id,
        planId: id,
        title: plan?.name ?? '已删除的选课方案',
        detail: plan ? `选课方案 · ${plan.courseIds.length} 个课堂` : '选课方案 · 原记录已不存在',
      });
    });
    const recordedArrangementIds = new Set(
      favoriteState.state.arrangementRecords.map((record) => record.id),
    );
    favoriteState.state.arrangementRecords.forEach((record) => {
      const plan = plansState.plans.find((item) => item.id === record.planId);
      const planName = plan?.name ?? record.planName;
      const courseSummary = record.courseNames.length > 0
        ? ` · ${record.courseNames.join('、')}`
        : '';
      items.push({
        kind: 'arrangement',
        id: record.id,
        planId: record.planId,
        title: `${planName} · 排课方案 #${record.originalIndex}`,
        detail: `${record.courseCount} 门 · ${record.totalCredits} 学分 / ${record.totalHours} 学时 · ${
          record.conflictCount === 0 ? '无冲突' : `${record.conflictCount} 冲突`
        }${courseSummary}`,
      });
    });
    favoriteState.state.arrangementIds
      .filter((id) => !recordedArrangementIds.has(id))
      .forEach((id, index) => {
        const arrangement = arrangementById.get(id);
        const number = arrangement ? arrangementNumbers.get(id) ?? index : index;
        items.push({
          kind: 'arrangement',
          id,
          planId: arrangement ? activePlan?.id : undefined,
          title: arrangement
            ? `${activePlan?.name ?? '当前选课方案'} · 排课方案 #${number}`
            : `旧版排课方案收藏 ${index + 1}`,
          detail: arrangement
            ? `${arrangement.courseCount} 门 · ${arrangement.totalCredits} 学分 / ${arrangement.totalHours} 学时 · ${
              arrangement.conflictCount === 0 ? '无冲突' : `${arrangement.conflictCount} 冲突`
            }`
            : '当前排课结果中暂不可见',
        });
      });
    favoriteState.state.timeGroupKeys.forEach((id) => {
      const group = groupByKey.get(id);
      items.push({
        kind: 'timeGroup',
        id,
        groupKey: id,
        title: group?.courseName ?? id,
        detail: group
          ? `时间组 · ${group.sectionIds.join('、')}`
          : '时间组 · 当前课程目录中暂不可见',
      });
    });
    favoriteState.state.sectionIds.forEach((id) => {
      const section = courseMap.get(id);
      items.push({
        kind: 'section',
        id,
        groupKey: sectionGroupKeyById.get(id),
        title: section?.courseName ?? id,
        detail: section ? `具体课堂 · ${id}` : '具体课堂 · 当前课程目录中暂不可见',
      });
    });

    return items;
  }, [
    conflictFreeArrangements,
    activePlan?.id,
    activePlan?.name,
    arrangementNumbers,
    courseMap,
    favoriteState.state,
    groupByKey,
    plansState.plans,
    recommendedArrangements,
    sectionGroupKeyById,
  ]);

  const detailGroup = useMemo<CourseGroup | null>(() => {
    if (!detailGroupKey) return null;
    const canonicalGroup = groupByKey.get(detailGroupKey);
    if (!customSettings.mergeAllTimeGroups) return canonicalGroup ?? null;
    if (canonicalGroup) return mergedGroupByCode.get(canonicalGroup.courseCode) ?? canonicalGroup;
    return mergedGroupByKey.get(detailGroupKey) ?? null;
  }, [
    customSettings.mergeAllTimeGroups,
    detailGroupKey,
    groupByKey,
    mergedGroupByCode,
    mergedGroupByKey,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRICULUM_SELECTION_KEY, JSON.stringify(curriculumSelection));
    } catch {
      // 忽略写入失败（隐私模式）
    }
  }, [curriculumSelection]);

  useEffect(() => {
    saveCustomScheduleSettings(customSettings);
  }, [customSettings]);

  useEffect(() => {
    if (catalogStatus.error) void message.error(catalogStatus.error);
  }, [catalogStatus.error, message]);

  // 切换方案时关闭详情弹窗 + 清空排课选择
  useEffect(() => {
    setDetailGroupKey(null);
    setArrangementView('recommended');
    setRecommendedArrangementSelection({ inputKey: null, id: null });
    setConflictFreeArrangementSelection({ inputKey: null, id: null });
  }, [activePlan?.id]);
  useLayoutEffect(() => {
    setRecommendedArrangementSelection((current) => ({
      inputKey: committedArrangementInputKey,
      id: resolveSelectedArrangementId(current.id, recommendedArrangements),
    }));
  }, [committedArrangementInputKey, recommendedArrangements]);
  useLayoutEffect(() => {
    if (arrangementView !== 'conflict-free') return;
    setConflictFreeArrangementSelection((current) => ({
      inputKey: committedArrangementInputKey,
      id: current.inputKey === committedArrangementInputKey
        && conflictFreeArrangements.some(({ id }) => id === current.id)
        ? current.id
        : conflictFreeArrangements[0]?.id ?? null,
    }));
  }, [arrangementView, committedArrangementInputKey, conflictFreeArrangements]);
  useEffect(() => {
    if (!activePlan) return;
    const recordedIds = new Set(favoriteState.state.arrangementRecords.map((record) => record.id));
    const records = recommendedArrangements.flatMap((arrangement, index) => {
      if (!favoriteState.state.arrangementIds.includes(arrangement.id) || recordedIds.has(arrangement.id)) {
        return [];
      }
      return [createArrangementFavoriteRecord(
        activePlan,
        arrangement,
        arrangementNumbers.get(arrangement.id) ?? index,
      )];
    });
    if (records.length > 0) favoriteState.rememberArrangements(records);
  }, [
    activePlan,
    arrangementNumbers,
    favoriteState,
    recommendedArrangements,
  ]);
  useEffect(() => {
    if (!pendingFavoriteArrangement || activePlan?.id !== pendingFavoriteArrangement.planId) return;
    const expectedScope = `${catalog.semester.key}:${pendingFavoriteArrangement.planId}`;
    const action = pendingFavoriteArrangementAction(
      calculation,
      expectedScope,
      pendingFavoriteArrangement.arrangementId,
    );
    if (action === 'open') {
      const arrangement = recommendedArrangements.find(
        (item) => item.id === pendingFavoriteArrangement.arrangementId,
      );
      if (!arrangement) return;
      setArrangementView('recommended');
      setRecommendedArrangementSelection({
        inputKey: committedArrangementInputKey,
        id: arrangement.id,
      });
      const number = arrangementNumbers.get(arrangement.id);
      message.success(`已打开${activePlan.name}的排课方案${number === undefined ? '' : ` #${number}`}`);
      setPendingFavoriteArrangement(null);
      return;
    }
    if (action === 'calculate') {
      calculation.startCalculation();
      return;
    }
    if (action === 'missing') {
      message.warning('该收藏排课方案已不在当前计算结果中');
      setPendingFavoriteArrangement(null);
      return;
    }
    if (action === 'empty') {
      message.warning('该排课方案所属的选课方案已无可排课程');
      setPendingFavoriteArrangement(null);
    }
  }, [
    activePlan,
    arrangementNumbers,
    calculation.committed?.scopeKey,
    calculation.draft.scopeKey,
    calculation.phase,
    calculation.startCalculation,
    catalog.semester.key,
    committedArrangementInputKey,
    message,
    pendingFavoriteArrangement,
    recommendedArrangements,
  ]);
  useEffect(() => {
    setArrangementView('recommended');
    setConflictFreeArrangementSelection({ inputKey: null, id: null });
  }, [calculation.draft.inputKey]);

  const handleExport = async () => {
    if (!exportRef.current) {
      message.warning('课表尚未准备好');
      return;
    }
    setExporting(true);
    try {
      await exportTimetableImage(exportRef.current, {
        planName: activePlan?.name ?? '选课方案',
        weekLabel: getWeekLabel(weekSelection),
      });
      message.success('课表图片已导出');
    } catch {
      message.error('导出图片失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const handleCurriculumChange = (id: string | null) => {
    setCurriculumSelection({
      curriculumId: id,
      term: getDefaultCurriculumTerm(id),
    });
  };

  const handleCurriculumTermChange = (term: string | null) => {
    setCurriculumSelection((current) => ({
      curriculumId: current.curriculumId,
      term: term && isValidCurriculumTerm(current.curriculumId, term) ? term : null,
    }));
  };

  const handleArrangementChange = (id: string) => {
    if (id === appliedArrangement?.id) return;
    const index = arrangements.findIndex((arrangement) => arrangement.id === id);
    if (arrangementView === 'recommended') {
      setRecommendedArrangementSelection({ inputKey: committedArrangementInputKey, id });
    } else {
      setConflictFreeArrangementSelection({ inputKey: committedArrangementInputKey, id });
    }
    if (index >= 0) message.success(`已切换到排课方案 #${arrangementNumbers.get(id) ?? index}`);
  };
  const handleToggleArrangementFavorite = (arrangement: Arrangement, number: number) => {
    if (!activePlan) return;
    const exactRecord = favoriteState.state.arrangementRecords.find(
      (record) => record.id === arrangement.id && record.planId === activePlan.id,
    );
    if (activeArrangementFavoriteIdSet.has(arrangement.id) && !exactRecord) {
      favoriteState.toggle('arrangement', arrangement.id);
      return;
    }
    favoriteState.toggleArrangement(
      exactRecord ?? createArrangementFavoriteRecord(activePlan, arrangement, number),
    );
  };
  const handleOpenFavorite = (item: FavoriteManagerItem) => {
    if (item.kind === 'plan') {
      setFavoritesOpen(false);
      if (item.planId && plansState.plans.some((plan) => plan.id === item.planId)) {
        dispatch({ type: 'switchPlan', id: item.planId });
      } else {
        message.warning('该选课方案已不存在');
      }
      return;
    }
    if (item.kind === 'arrangement') {
      setFavoritesOpen(false);
      if (!item.planId || !plansState.plans.some((plan) => plan.id === item.planId)) {
        message.warning('该排课方案所属的选课方案已不存在');
        return;
      }
      setPendingFavoriteArrangement({ planId: item.planId, arrangementId: item.id });
      setArrangementView('recommended');
      if (activePlan?.id !== item.planId) dispatch({ type: 'switchPlan', id: item.planId });
      return;
    }
    if (item.groupKey && groupByKey.has(item.groupKey)) {
      setDetailGroupKey(item.groupKey);
    } else {
      message.warning('该课程已不在当前课程目录中');
    }
  };
  const handleRemoveFavorite = (item: FavoriteManagerItem) => {
    if (item.kind === 'arrangement' && item.planId) {
      const record = favoriteState.state.arrangementRecords.find(
        (candidate) => candidate.id === item.id && candidate.planId === item.planId,
      );
      if (record) {
        favoriteState.toggleArrangement(record);
        return;
      }
    }
    favoriteState.toggle(item.kind, item.id);
  };
  const showAllConflictFreeArrangements = () => {
    setArrangementView('conflict-free');
    calculation.loadAllConflictFree();
  };
  const calculationStatus = (
    <CalculationStatus
      phase={calculation.phase}
      mode={calculation.draft.settings.calculationMode}
      hasSnapshot={calculation.hasSnapshot}
      actionLabel={calculation.actionLabel}
      error={calculation.error}
      onCalculate={calculation.startCalculation}
      compact={true}
    />
  );

  const openCourseDetailFromManager = (groupKey: string) => {
    setDetailGroupKey(groupKey);
  };

  const openSelectedCourses = useCallback((tab: 'current' | 'curriculum') => {
    setSelectedCoursesTab(tab);
    setSelectedCoursesOpen(true);
  }, []);

  const handleWizardComplete = (preferences: OnboardingPreferences, startTour: boolean) => {
    setCustomSettings((current) => ({
      ...current,
      calculationMode: preferences.calculationMode,
      preferHalfDay: preferences.preferHalfDay,
      preferFewerEarlyMornings: preferences.preferFewerEarlyMornings,
      preferAvoidCampusTransfers: preferences.preferAvoidCampusTransfers,
      residentCampus: preferences.residentCampus,
    }));
    updateAwareness.setShowUpdatePopup(preferences.showUpdatePopup);
    message.success('排课倾向已同步到自定义设置');
    onboarding.finishWizard(preferences, startTour);
  };

  const handleRestartOnboarding = () => {
    setDetailGroupKey(null);
    setFavoritesOpen(false);
    setCustomizationOpen(false);
    window.setTimeout(() => onboarding.startTour(), 220);
  };

  const handleOpenUpdateHistory = () => {
    setUpdateHistoryOpen(true);
    void updateAwareness.loadFullHistory();
  };

  const handleSelectReplacement = (
    event: CourseImpactEvent,
    candidate: SelectedCourseSnapshot,
  ) => {
    const affectedPlanIds = new Set(event.affectedPlans.map((plan) => plan.planId));
    const applyToPlans = (state: typeof plansState) => ({
      ...state,
      plans: state.plans.map((plan) => {
        if (!affectedPlanIds.has(plan.id) || plan.courseIds.includes(candidate.id)) return plan;
        return {
          ...plan,
          updatedAt: Date.now(),
          courseIds: [...plan.courseIds, candidate.id],
        };
      }),
    });

    if (event.semesterKey === catalog.semester.key) {
      if (!courseMap.has(candidate.id)) {
        message.warning('该候选课堂已不在当前课程目录中');
        return;
      }
      dispatch({ type: 'init', payload: applyToPlans(plansState) });
      message.success(`已将 ${candidate.id} 加入受影响方案`);
      return;
    }

    const stored = loadPlansPayload(event.semesterKey, {
      defaultSemester: manifest.defaultSemester,
    });
    if (!stored) {
      message.warning('未找到该学期的本地方案');
      return;
    }
    const nextState = applyToPlans(stored.state);
    savePlansPayload(event.semesterKey, {
      ...stored,
      state: nextState,
      selectedSnapshots: {
        ...stored.selectedSnapshots,
        [candidate.id]: candidate,
      },
    });
    message.success(`已将 ${candidate.id} 加入该学期的受影响方案`);
  };

  const handleTourStepAction = useCallback((action: NonNullable<TourStep['action']>) => {
    setDetailGroupKey(null);
    setFavoritesOpen(false);
    if (action === 'openSelectedCoursesCurriculum') {
      setCustomizationOpen(false);
      openSelectedCourses('curriculum');
      return;
    }
    if (action === 'closeSelectedCourses') {
      setSelectedCoursesOpen(false);
      setCustomizationOpen(false);
      return;
    }
    if (action === 'openCustomization') {
      setSelectedCoursesOpen(false);
      setCustomizationInitialPage('blockedSlots');
      setCustomizationOpen(true);
      return;
    }
    if (action === 'closeCustomization') {
      setCustomizationOpen(false);
    }
  }, [openSelectedCourses]);

  const handleTourFinish = () => {
    setDetailGroupKey(null);
    setSelectedCoursesOpen(false);
    setFavoritesOpen(false);
    setCustomizationOpen(false);
    onboarding.finishTour();
  };

  const handleTourSkip = () => {
    setDetailGroupKey(null);
    setSelectedCoursesOpen(false);
    setFavoritesOpen(false);
    setCustomizationOpen(false);
    onboarding.skipTour();
  };

  return (
    <Layout className="app-layout">
      <Layout.Content className="app-content">
        <div className="pool-panel no-print">
          <div className="panel-inner plan-summary">
            <PlanSwitcher
              curriculumOptions={curriculumOptions}
              selectedCurriculumId={curriculumSelection.curriculumId}
              onCurriculumChange={handleCurriculumChange}
              onManageCurriculum={() => openSelectedCourses('curriculum')}
            />
            <StatsBar
              stats={stats}
              favoriteCount={favoriteItems.length}
              onOpenSelectedCourses={() => openSelectedCourses('current')}
              onOpenFavorites={() => setFavoritesOpen(true)}
            />
          </div>
          <div className="panel-inner calculation-results no-print">
            <ArrangementPanel
              arrangements={arrangements}
              selectedId={appliedArrangement?.id ?? null}
              onSelect={handleArrangementChange}
              status={calculationStatus}
              mode={arrangementView}
              totalConflictFreeCount={calculation.committed?.totalConflictFreeCount ?? 0}
              allConflictFreePhase={calculation.allConflictFreePhase}
              allConflictFreeError={calculation.allConflictFreeError}
              onShowConflictFree={showAllConflictFreeArrangements}
              numbersById={arrangementNumbers}
              favoriteIds={activeArrangementFavoriteIdSet}
              onToggleFavorite={handleToggleArrangementFavorite}
            />
          </div>
          <div className="course-search-tour-target" data-tour="course-search-area">
            <FilterBar
              filter={filter}
              setFilter={setFilter}
              options={filterOptions}
            />
            <CoursePool
              groups={filteredGroups}
              selectedIds={selectedIds}
              conflictGroupKeys={conflictGroupKeys}
              themeMode={themeMode}
              onOpenDetail={setDetailGroupKey}
              courseMap={courseMap}
              groupsByCode={groupsByCode}
            />
          </div>
        </div>
        <div className="table-panel">
          <CourseTable
            weekSelection={weekSelection}
            setWeekSelection={setWeekSelection}
            groups={appliedGroups}
            exportRef={exportRef}
            onOpenDetail={setDetailGroupKey}
            themeMode={themeMode}
            onToggleTheme={onToggleTheme}
            onExport={handleExport}
            exporting={exporting}
            blockedSlots={committedBlockedSlots}
            onOpenCustomization={() => {
              setCustomizationInitialPage('main');
              setCustomizationOpen(true);
            }}
            calendar={catalog.semester.calendar}
            catalogGeneratedAt={catalog.generatedAt}
            semesters={manifest.semesters}
            semesterKey={catalog.semester.key}
            semesterSwitching={catalogStatus.phase === 'switching'}
            onSemesterChange={async (semesterKey) => {
              await switchSemester(semesterKey);
            }}
          />
        </div>
      </Layout.Content>
      <SelectedCoursesModal
        open={selectedCoursesOpen}
        initialTab={selectedCoursesTab}
        onClose={() => setSelectedCoursesOpen(false)}
        appliedGroups={appliedGroups}
        allSelectedGroups={allSelectedGroups}
        selectedIds={selectedIds}
        conflictGroupKeys={conflictGroupKeys}
        arrangements={arrangements}
        arrangementNumbers={arrangementNumbers}
        currentArrangementId={appliedArrangement?.id ?? null}
        selectedCurriculumId={curriculumSelection.curriculumId}
        selectedCurriculumTerm={curriculumSelection.term}
        onArrangementChange={handleArrangementChange}
        onCurriculumChange={handleCurriculumChange}
        onCurriculumTermChange={handleCurriculumTermChange}
        onOpenDetail={openCourseDetailFromManager}
        groupsByCode={groupsByCode}
      />
      <FavoritesManagerModal
        open={favoritesOpen}
        items={favoriteItems}
        onClose={() => setFavoritesOpen(false)}
        onOpen={handleOpenFavorite}
        onRemove={handleRemoveFavorite}
      />
      <CustomizationModal
        open={customizationOpen}
        settings={customSettings}
        onChange={setCustomSettings}
        onClose={() => setCustomizationOpen(false)}
        onRestartOnboarding={handleRestartOnboarding}
        showUpdatePopup={updateAwareness.preferences.showUpdatePopup}
        onShowUpdatePopupChange={updateAwareness.setShowUpdatePopup}
        onOpenUpdateHistory={handleOpenUpdateHistory}
        initialPage={customizationInitialPage}
      />
      {updateAwareness.automaticNotice ? (
        <UpdateNoticeModal
          open={automaticNoticeOpen}
          notice={updateAwareness.automaticNotice}
          onClose={() => setAutomaticNoticeOpen(false)}
          afterClose={updateAwareness.acknowledgeAutomaticNotice}
          onSelectReplacement={handleSelectReplacement}
        />
      ) : null}
      <UpdateHistoryModal
        open={updateHistoryOpen}
        loading={updateAwareness.history.loading}
        failedSemesterKeys={updateAwareness.history.failedSemesterKeys}
        appReleases={updateAwareness.history.appReleases}
        semesters={updateAwareness.history.semesters}
        onClose={() => setUpdateHistoryOpen(false)}
      />
      <CourseDetailModal
        group={detailGroup}
        detail={
          detailGroup?.sections[0]
            ? catalog.detailsBySection[detailGroup.sections[0].id]
            : undefined
        }
        open={!!detailGroup}
        onClose={() => setDetailGroupKey(null)}
        allSelectedGroups={allSelectedGroups}
        groupsByCode={groupsByCode}
      />
      <OnboardingWizard
        open={onboarding.stage === 'wizard'}
        preferences={onboarding.state.preferences}
        onComplete={handleWizardComplete}
        onSkip={onboarding.skipWizard}
      />
      <SpotlightTour
        open={onboarding.stage === 'tour'}
        entryMode={onboarding.tourEntryMode}
        onFinish={handleTourFinish}
        onSkip={handleTourSkip}
        onStepAction={handleTourStepAction}
      />
    </Layout>
  );
}

export default function App() {
  const { catalog, courseMap, manifest } = useSemesterCatalog();
  const [themeMode, setThemeMode] = useState<Theme>(readInitialTheme);
  const activeThemeTransitionRef = useRef<ReturnType<Document['startViewTransition']> | null>(null);

  // 把主题挂到 <html> 上，CSS 变量自动切换
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  const toggleTheme = () => {
    const next: Theme = themeMode === 'dark' ? 'light' : 'dark';
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // 忽略写入失败（隐私模式）
      }
      flushSync(() => {
        document.documentElement.dataset.theme = next;
        setThemeMode(next);
      });
    };
    const root = document.documentElement;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const commitWithoutViewTransition = () => {
      root.classList.add('theme-transitioning');
      commit();
      // 先在禁用补间的状态下强制提交新样式，再同步解除冻结。
      void root.offsetWidth;
      root.classList.remove('theme-transitioning');
    };

    // 主题过渡仅交给 View Transition API；不支持或减少动效时直接切换。
    if (prefersReducedMotion || typeof document.startViewTransition !== 'function') {
      activeThemeTransitionRef.current?.skipTransition();
      activeThemeTransitionRef.current = null;
      commitWithoutViewTransition();
      return;
    }

    // 快速连续切换时结束旧快照，避免多组 root 过渡叠加。
    activeThemeTransitionRef.current?.skipTransition();
    activeThemeTransitionRef.current = null;
    root.classList.add('theme-transitioning');

    let transition: ReturnType<Document['startViewTransition']>;
    try {
      transition = document.startViewTransition(commit);
    } catch {
      commitWithoutViewTransition();
      return;
    }

    activeThemeTransitionRef.current = transition;
    const finish = () => {
      if (activeThemeTransitionRef.current !== transition) return;
      activeThemeTransitionRef.current = null;
      root.classList.remove('theme-transitioning');
    };
    void transition.finished.then(finish, finish);
  };

  return (
    <ConfigProvider
      locale={zhCN}
      wave={{ disabled: true }}
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          ...(themeMode === 'dark'
            ? DARK_ANTD_THEME_TOKENS
            : { colorPrimary: '#4f6bed' }),
          borderRadius: 6,
        },
        components: {
          Button: {
            defaultShadow: 'none',
            primaryShadow: 'none',
            dangerShadow: 'none',
          },
          Layout: {
            headerBg: 'var(--panel-bg)',
            bodyBg: 'var(--bg)',
          },
        },
      }}
    >
      <AntApp>
        <FavoritesProvider
          key={`favorites:${catalog.semester.key}`}
          semesterKey={catalog.semester.key}
        >
          <PlansProvider
            key={catalog.semester.key}
            semesterKey={catalog.semester.key}
            defaultSemesterKey={manifest.defaultSemester}
            courseMap={courseMap}
            catalogRevision={catalog.revision}
          >
            <MainArea themeMode={themeMode} onToggleTheme={toggleTheme} />
          </PlansProvider>
        </FavoritesProvider>
      </AntApp>
    </ConfigProvider>
  );
}
