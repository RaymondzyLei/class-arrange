import type { PlanStats } from '@/utils/stats';
import { WarningIcon } from './icons';

interface Props {
  stats: PlanStats;
  onOpenSelectedCourses?: () => void;
}

export default function StatsBar({ stats, onOpenSelectedCourses }: Props) {
  return (
    <div className="stats-bar">
      <button
        className="stats-bar__item stats-bar__item--button"
        type="button"
        onClick={onOpenSelectedCourses}
        disabled={!onOpenSelectedCourses}
      >
        <span className="stats-bar__label">已选课程</span>
        <span className="stats-bar__value">{stats.count} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-sub)' }}>门</span></span>
      </button>
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
          {stats.conflictCount > 0 ? <WarningIcon className="stats-bar__warning-icon" /> : null}
          {stats.conflictCount} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-sub)' }}>门</span>
        </span>
      </div>
    </div>
  );
}
