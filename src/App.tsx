import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ConfigProvider, Layout, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PlansProvider, usePlans } from '@/store/plansContext';
import { computeStats } from '@/utils/stats';
import { buildCourseGroups } from '@/utils/courseGroup';
import { useSemesterCatalog } from '@/data/SemesterCatalogContext';
import { pickDefaultArrangement } from '@/utils/arrangement';
import type { Arrangement, CourseGroup, FilterState } from '@/types';
import PlanSwitcher from '@/components/PlanSwitcher';
import FilterBar from '@/components/FilterBar';
import CoursePool from '@/components/CoursePool';
import CourseTable from '@/components/CourseTable';
import StatsBar from '@/components/StatsBar';
import ArrangementPanel from '@/components/ArrangementPanel';
import CalculationStatus from '@/components/CalculationStatus';
import CourseDetailModal from '@/components/CourseDetailModal';
import SelectedCoursesModal from '@/components/SelectedCoursesModal';
import CustomizationModal from '@/components/CustomizationModal';
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
import { resolveSelectedArrangementId } from '@/utils/arrangementCalculationState';

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
  const { activePlan } = usePlans();
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
  const [arrangementSelection, setArrangementSelection] = useState<{
    inputKey: string | null;
    id: string | null;
  }>({ inputKey: null, id: null });
  const [selectedCoursesOpen, setSelectedCoursesOpen] = useState(false);
  const [selectedCoursesTab, setSelectedCoursesTab] = useState<'current' | 'curriculum'>('current');
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomScheduleSettings>(
    readCustomScheduleSettings,
  );
  const onboarding = useOnboarding();
  const [curriculumSelection, setCurriculumSelection] = useState<CurriculumSelection>(readInitialCurriculumSelection);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const filteredGroups = useFilteredCourses(courses, groups, filter);

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

  const calculation = useArrangementCalculation({
    scopeKey: `${catalog.semester.key}:${activePlan?.id ?? 'no-plan'}`,
    groups: allSelectedGroups,
    settings: customSettings,
  });
  const arrangements = calculation.committed?.arrangements ?? EMPTY_ARRANGEMENTS;
  const committedArrangementInputKey = calculation.committed?.inputKey ?? null;
  const selectedArrangementId = arrangementSelection.inputKey === committedArrangementInputKey
    ? arrangementSelection.id
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

  const detailGroup = useMemo<CourseGroup | null>(() => {
    if (!detailGroupKey) return null;
    return groupByKey.get(detailGroupKey) ?? null;
  }, [detailGroupKey, groupByKey]);

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
    setArrangementSelection({ inputKey: null, id: null });
  }, [activePlan?.id]);
  useLayoutEffect(() => {
    setArrangementSelection((current) => ({
      inputKey: committedArrangementInputKey,
      id: resolveSelectedArrangementId(current.id, arrangements),
    }));
  }, [arrangements, committedArrangementInputKey]);

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
    setArrangementSelection({ inputKey: committedArrangementInputKey, id });
    if (index >= 0) message.success(`已切换到排课方案 #${index}`);
  };

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
    message.success('排课倾向已同步到自定义设置');
    onboarding.finishWizard(preferences, startTour);
  };

  const handleRestartOnboarding = () => {
    setDetailGroupKey(null);
    setCustomizationOpen(false);
    window.setTimeout(() => onboarding.startTour(), 220);
  };

  const handleTourStepAction = useCallback((action: NonNullable<TourStep['action']>) => {
    setDetailGroupKey(null);
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
    setCustomizationOpen(false);
    onboarding.finishTour();
  };

  const handleTourSkip = () => {
    setDetailGroupKey(null);
    setSelectedCoursesOpen(false);
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
            <StatsBar stats={stats} onOpenSelectedCourses={() => openSelectedCourses('current')} />
          </div>
          <div className="panel-inner calculation-results no-print">
            <CalculationStatus
              phase={calculation.phase}
              mode={calculation.draft.settings.calculationMode}
              hasSnapshot={calculation.hasSnapshot}
              actionLabel={calculation.actionLabel}
              error={calculation.error}
              onCalculate={calculation.startCalculation}
            />
            {arrangements.length > 1 && (
              <ArrangementPanel
                arrangements={arrangements}
                selectedId={appliedArrangement?.id ?? null}
                onSelect={handleArrangementChange}
              />
            )}
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
            onOpenCustomization={() => setCustomizationOpen(true)}
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
        currentArrangementId={appliedArrangement?.id ?? null}
        selectedCurriculumId={curriculumSelection.curriculumId}
        selectedCurriculumTerm={curriculumSelection.term}
        onArrangementChange={handleArrangementChange}
        onCurriculumChange={handleCurriculumChange}
        onCurriculumTermChange={handleCurriculumTermChange}
        onOpenDetail={openCourseDetailFromManager}
        groupsByCode={groupsByCode}
      />
      <CustomizationModal
        open={customizationOpen}
        settings={customSettings}
        onChange={setCustomSettings}
        onClose={() => setCustomizationOpen(false)}
        onRestartOnboarding={handleRestartOnboarding}
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
  const validCourseIds = useMemo(() => new Set(courseMap.keys()), [courseMap]);
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
        <PlansProvider
          key={catalog.semester.key}
          semesterKey={catalog.semester.key}
          defaultSemesterKey={manifest.defaultSemester}
          validCourseIds={validCourseIds}
        >
          <MainArea themeMode={themeMode} onToggleTheme={toggleTheme} />
        </PlansProvider>
      </AntApp>
    </ConfigProvider>
  );
}
