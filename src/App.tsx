import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ConfigProvider, Layout, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PlansProvider, usePlans } from '@/store/plansContext';
import { getCourseById } from '@/data';
import { computeStats } from '@/utils/stats';
import { buildCourseGroups, getAllCourseGroupsByKey } from '@/utils/courseGroup';
import { enumerateArrangements, pickDefaultArrangement } from '@/utils/arrangement';
import type { Arrangement, CourseGroup, FilterState } from '@/types';
import PlanSwitcher from '@/components/PlanSwitcher';
import FilterBar from '@/components/FilterBar';
import CoursePool from '@/components/CoursePool';
import CourseTable from '@/components/CourseTable';
import StatsBar from '@/components/StatsBar';
import ArrangementPanel from '@/components/ArrangementPanel';
import CourseDetailModal from '@/components/CourseDetailModal';
import SelectedCoursesModal from '@/components/SelectedCoursesModal';
import CustomizationModal from '@/components/CustomizationModal';
import { useConflicts } from '@/hooks/useConflicts';
import { useFilteredCourses } from '@/hooks/useFilteredCourses';
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

const EMPTY_FILTER: FilterState = {
  keyword: '',
  department: '',
  courseType: '',
  sectionType: '',
  examType: '',
  language: '',
};

const EMPTY_IDS: Set<string> = new Set();
const THEME_KEY = 'class-arrange:v1:theme';
const CURRICULUM_SELECTION_KEY = 'class-arrange:v1:curriculum-selection';
type Theme = 'light' | 'dark';

interface CurriculumSelection {
  curriculumId: string | null;
  term: string | null;
}

function readInitialTheme(): Theme {
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
  const { message } = AntApp.useApp();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [weekSelection, setWeekSelection] = useState<WeekSelection>(1);
  const [detailGroupKey, setDetailGroupKey] = useState<string | null>(null);
  const [selectedArrangementId, setSelectedArrangementId] = useState<string | null>(null);
  const [selectedCoursesOpen, setSelectedCoursesOpen] = useState(false);
  const [selectedCoursesTab, setSelectedCoursesTab] = useState<'current' | 'curriculum'>('current');
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomScheduleSettings>(
    readCustomScheduleSettings,
  );
  const [curriculumSelection, setCurriculumSelection] = useState<CurriculumSelection>(readInitialCurriculumSelection);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const filteredGroups = useFilteredCourses(filter);

  // 已选 sections → CourseGroup[]（按 groupKey 聚合）
  const allSelectedGroups = useMemo<CourseGroup[]>(() => {
    if (!activePlan) return [];
    const sections = activePlan.courseIds
      .map((id) => getCourseById(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return buildCourseGroups(sections);
  }, [activePlan]);

  // 已选 stable Set
  const selectedIds = useMemo<Set<string>>(
    () => (activePlan ? new Set(activePlan.courseIds) : EMPTY_IDS),
    [activePlan],
  );

  // 枚举：可能 0 个、1 个（无歧义）、≤8 个（按冲突升序取前 8）
  const arrangements = useMemo(
    () => enumerateArrangements(allSelectedGroups, customSettings),
    [allSelectedGroups, customSettings],
  );

  // 用户选择有效 → 应用之；否则用默认（最低冲突）
  const appliedArrangement: Arrangement | null = useMemo(() => {
    if (arrangements.length === 0) return null;
    if (selectedArrangementId) {
      const found = arrangements.find((a) => a.id === selectedArrangementId);
      if (found) return found;
    }
    return pickDefaultArrangement(arrangements);
  }, [arrangements, selectedArrangementId]);

  const appliedGroups = appliedArrangement?.groups ?? [];

  const { conflictGroupKeys } = useConflicts(appliedGroups, customSettings.blockedSlots);

  const stats = useMemo(
    () => computeStats(appliedGroups, conflictGroupKeys),
    [appliedGroups, conflictGroupKeys],
  );

  // 全量选课单元索引（模块级懒加载缓存，弹窗按 groupKey 查找）
  const groupByKey = getAllCourseGroupsByKey();

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
    setSelectedArrangementId(null);
  }, [customSettings]);

  // 切换方案时关闭详情弹窗 + 清空排课选择
  useEffect(() => {
    setDetailGroupKey(null);
    setSelectedArrangementId(null);
  }, [activePlan?.id]);
  // 用户加减课时，若选择的小卡片不再有效，重置选择回默认
  useEffect(() => {
    if (selectedArrangementId && appliedArrangement?.id !== selectedArrangementId) {
      setSelectedArrangementId(null);
    }
  }, [selectedArrangementId, appliedArrangement]);

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
    setSelectedArrangementId(id);
    if (index >= 0) message.success(`已切换到排课方案 #${index}`);
  };

  const openCourseDetailFromManager = (groupKey: string) => {
    setDetailGroupKey(groupKey);
  };

  const openSelectedCourses = (tab: 'current' | 'curriculum') => {
    setSelectedCoursesTab(tab);
    setSelectedCoursesOpen(true);
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
          {arrangements.length > 1 && (
            <ArrangementPanel
              arrangements={arrangements}
              selectedId={appliedArrangement?.id ?? null}
              onSelect={handleArrangementChange}
            />
          )}
          <FilterBar filter={filter} setFilter={setFilter} resultCount={filteredGroups.length} />
          <CoursePool
            groups={filteredGroups}
            selectedIds={selectedIds}
            conflictGroupKeys={conflictGroupKeys}
            themeMode={themeMode}
            onOpenDetail={setDetailGroupKey}
          />
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
            blockedSlots={customSettings.blockedSlots}
            onOpenCustomization={() => setCustomizationOpen(true)}
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
      />
      <CustomizationModal
        open={customizationOpen}
        settings={customSettings}
        onChange={setCustomSettings}
        onClose={() => setCustomizationOpen(false)}
      />
      <CourseDetailModal
        group={detailGroup}
        open={!!detailGroup}
        onClose={() => setDetailGroupKey(null)}
      />
    </Layout>
  );
}

export default function App() {
  const [themeMode, setThemeMode] = useState<Theme>(readInitialTheme);

  // 把主题挂到 <html> 上，CSS 变量自动切换
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  const toggleTheme = () => {
    const next: Theme = themeMode === 'dark' ? 'light' : 'dark';
    const commit = () => {
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
    const beginThemeTransition = () => {
      document.documentElement.classList.add('theme-transitioning');
      let cleared = false;
      return () => {
        if (cleared) return;
        cleared = true;
        document.documentElement.classList.remove('theme-transitioning');
      };
    };

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
      const endThemeTransition = beginThemeTransition();
      const transition = document.startViewTransition(commit);
      transition.finished.finally(endThemeTransition);
      return;
    }
    if (!prefersReducedMotion) {
      const endThemeTransition = beginThemeTransition();
      commit();
      window.setTimeout(endThemeTransition, 340);
      return;
    }
    commit();
  };

  return (
    <ConfigProvider
      locale={zhCN}
      wave={{ disabled: true }}
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#4f6bed',
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
        <PlansProvider>
          <MainArea themeMode={themeMode} onToggleTheme={toggleTheme} />
        </PlansProvider>
      </AntApp>
    </ConfigProvider>
  );
}
