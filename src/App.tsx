import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Layout, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PlansProvider, usePlans } from '@/store/plansContext';
import { getCourseById, courses } from '@/data';
import { computeStats } from '@/utils/stats';
import { buildCourseGroups } from '@/utils/courseGroup';
import type { CourseGroup, FilterState } from '@/types';
import TopBar from '@/components/TopBar';
import PlanSwitcher from '@/components/PlanSwitcher';
import FilterBar from '@/components/FilterBar';
import CoursePool from '@/components/CoursePool';
import CourseTable from '@/components/CourseTable';
import StatsBar from '@/components/StatsBar';
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

  const { conflicts, conflictGroupKeys } = useConflicts(activePlan);

  const selectedGroups = useMemo<CourseGroup[]>(() => {
    if (!activePlan) return [];
    const sections = activePlan.courseIds
      .map((id) => getCourseById(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return buildCourseGroups(sections);
  }, [activePlan]);

  // 稳定引用：避免父组件 re-render 时新建 Set，导致 CoursePool/grid 频繁重算
  const selectedIds = useMemo<Set<string>>(
    () => (activePlan ? new Set(activePlan.courseIds) : EMPTY_IDS),
    [activePlan],
  );

  const stats = useMemo(
    () => computeStats(selectedGroups, conflictGroupKeys),
    [selectedGroups, conflictGroupKeys],
  );

  // 全量选课单元索引（课程静态数据，模块级计算一次即可）
  const allGroups = useMemo(() => buildCourseGroups(courses), []);

  const detailGroup = useMemo<CourseGroup | null>(() => {
    if (!detailGroupKey) return null;
    return allGroups.find((g) => g.key === detailGroupKey) ?? null;
  }, [detailGroupKey, allGroups]);

  // 切换方案时关闭详情弹窗
  useEffect(() => setDetailGroupKey(null), [activePlan?.id]);

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
            onOpenDetail={setDetailGroupKey}
          />
        </div>
        <div className="table-panel">
          <CourseTable
            week={week}
            setWeek={setWeek}
            weeks={WEEKS}
            activePlan={activePlan}
            conflicts={conflicts}
            onOpenDetail={setDetailGroupKey}
          />
          <StatsBar stats={stats} />
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