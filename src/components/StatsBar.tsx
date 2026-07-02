import type { PlanStats } from '@/utils/stats';

interface Props {
  stats: PlanStats;
}

export default function StatsBar({ stats }: Props) {
  return (
    <div className="panel-inner stats-bar no-print">
      <div className="stats-bar__item">
        <span className="stats-bar__label">已选课程</span>
        <span className="stats-bar__value">{stats.count} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-sub)' }}>门</span></span>
      </div>
      <div className="stats-bar__item">
        <span className="stats-bar__label">总学分</span>
        <span className="stats-bar__value">{stats.totalCredits}</span>
      </div>
      <div className="stats-bar__item">
        <span className="stats-bar__label">总学时</span>
        <span className="stats-bar__value">{stats.totalHours}</span>
      </div>
      <div className="stats-bar__item">
        <span className="stats-bar__label">冲突课程</span>
        <span className={`stats-bar__value${stats.conflictCount > 0 ? ' stats-bar__value--conflict' : ''}`}>
          {stats.conflictCount > 0 ? '⚠ ' : ''}{stats.conflictCount} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-sub)' }}>门</span>
        </span>
      </div>
    </div>
  );
}