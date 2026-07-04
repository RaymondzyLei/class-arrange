import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Layout, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PlansProvider, usePlans } from '@/store/plansContext';
import { getCourseById } from '@/data';
import { computeStats } from '@/utils/stats';
import { buildCourseGroups, getAllCourseGroupsByKey } from '@/utils/courseGroup';
import { enumerateArrangements, pickDefaultArrangement } from '@/utils/arrangement';
import type { Arrangement, CourseGroup, FilterState } from '@/types';
import TopBar from '@/components/TopBar';
import PlanSwitcher from '@/components/PlanSwitcher';
import FilterBar from '@/components/FilterBar';
import CoursePool from '@/components/CoursePool';
import CourseTable from '@/components/CourseTable';
import StatsBar from '@/components/StatsBar';
import ArrangementPanel from '@/components/ArrangementPanel';
import CourseDetailModal from '@/components/CourseDetailModal';
import { useConflicts } from '@/hooks/useConflicts';
import { WEEKS } from '@/constants/grid';

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
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [week, setWeek] = useState<number>(1);
  const [detailGroupKey, setDetailGroupKey] = useState<string | null>(null);
  const [selectedArrangementId, setSelectedArrangementId] = useState<string | null>(null);

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

  const { conflicts, conflictGroupKeys } = useConflicts(appliedGroups);

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

  return (
    <Layout className="app-layout">
      <TopBar themeMode={themeMode} onToggleTheme={onToggleTheme} />
      <Layout.Content className="app-content">
        <div className="pool-panel no-print">
          <PlanSwitcher />
          <FilterBar filter={filter} setFilter={setFilter} />
          <CoursePool
            filter={filter}
            selectedIds={selectedIds}
            conflictGroupKeys={conflictGroupKeys}
            themeMode={themeMode}
            onOpenDetail={setDetailGroupKey}
          />
        </div>
        <div className="table-panel">
          <CourseTable
            week={week}
            setWeek={setWeek}
            weeks={WEEKS}
            groups={appliedGroups}
            conflicts={conflicts}
            onOpenDetail={setDetailGroupKey}
          />
          <StatsBar stats={stats} />
          {arrangements.length > 1 && (
            <ArrangementPanel
              arrangements={arrangements}
              selectedId={appliedArrangement?.id ?? null}
              onSelect={(id) => setSelectedArrangementId(id)}
            />
          )}
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
    setThemeMode((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // 忽略写入失败（隐私模式）
      }
      return next;
    });
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#4f6bed',
          borderRadius: 6,
        },
        components: {
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