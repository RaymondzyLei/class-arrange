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
import { useConflicts } from '@/hooks/useConflicts';
import { useFilteredCourses } from '@/hooks/useFilteredCourses';
import { exportTimetableImage } from '@/utils/exportPrint';
import type { WeekSelection } from '@/config/termCalendar';
import { getWeekLabel } from '@/config/termCalendar';

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
type Theme = 'light' | 'dark';

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

function MainArea({ themeMode, onToggleTheme }: { themeMode: Theme; onToggleTheme: () => void }) {
  const { activePlan } = usePlans();
  const { message } = AntApp.useApp();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [weekSelection, setWeekSelection] = useState<WeekSelection>(1);
  const [detailGroupKey, setDetailGroupKey] = useState<string | null>(null);
  const [selectedArrangementId, setSelectedArrangementId] = useState<string | null>(null);
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
    () => enumerateArrangements(allSelectedGroups),
    [allSelectedGroups],
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

  const { conflictGroupKeys } = useConflicts(appliedGroups);

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

  // 切换方案时关闭详情弹窗 + 清空排课选择
  useEffect(() => setDetailGroupKey(null), [activePlan?.id]);
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

  return (
    <Layout className="app-layout">
      <Layout.Content className="app-content">
        <div className="pool-panel no-print">
          <div className="panel-inner plan-summary">
            <PlanSwitcher />
            <StatsBar stats={stats} />
          </div>
          {arrangements.length > 1 && (
            <ArrangementPanel
              arrangements={arrangements}
              selectedId={appliedArrangement?.id ?? null}
              onSelect={(id) => setSelectedArrangementId(id)}
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
          />
        </div>
      </Layout.Content>
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
    const markTransitioning = () => {
      document.documentElement.classList.add('theme-transitioning');
      window.setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 340);
    };

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
      markTransitioning();
      document.startViewTransition(commit);
      return;
    }
    if (!prefersReducedMotion) markTransitioning();
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
