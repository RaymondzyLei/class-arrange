import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Layout, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PlansProvider, usePlans } from '@/store/plansContext';
import { getCourseById } from '@/data';
import { computeStats } from '@/utils/stats';
import type { CourseSection, FilterState } from '@/types';
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

function MainArea() {
  const { activePlan } = usePlans();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [week, setWeek] = useState<number>(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { conflicts, conflictIds } = useConflicts(activePlan);

  const selectedSections = useMemo<CourseSection[]>(() => {
    if (!activePlan) return [];
    return activePlan.courseIds
      .map((id) => getCourseById(id))
      .filter((c): c is CourseSection => Boolean(c));
  }, [activePlan]);

  // 稳定引用：避免父组件 re-render 时新建 Set，导致 CoursePool/grid 频繁重算
  const selectedIds = useMemo<Set<string>>(
    () => (activePlan ? new Set(activePlan.courseIds) : EMPTY_IDS),
    [activePlan],
  );

  const stats = useMemo(
    () => computeStats(selectedSections, conflictIds),
    [selectedSections, conflictIds],
  );

  const detailCourse = detailId ? getCourseById(detailId) ?? null : null;

  // 切换方案时关闭详情弹窗
  useEffect(() => setDetailId(null), [activePlan?.id]);

  return (
    <Layout className="app-layout">
      <TopBar />
      <Layout.Content className="app-content">
        <div className="pool-panel no-print">
          <PlanSwitcher />
          <FilterBar filter={filter} setFilter={setFilter} />
          <CoursePool
            filter={filter}
            selectedIds={selectedIds}
            conflictIds={conflictIds}
            onOpenDetail={setDetailId}
          />
        </div>
        <div className="table-panel">
          <CourseTable
            week={week}
            setWeek={setWeek}
            weeks={WEEKS}
            activePlan={activePlan}
            conflicts={conflicts}
            onOpenDetail={setDetailId}
          />
          <StatsBar stats={stats} />
        </div>
      </Layout.Content>
      <CourseDetailModal
        course={detailCourse}
        open={!!detailCourse}
        onClose={() => setDetailId(null)}
      />
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <PlansProvider>
          <MainArea />
        </PlansProvider>
      </AntApp>
    </ConfigProvider>
  );
}
