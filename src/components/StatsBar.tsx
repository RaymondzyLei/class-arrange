import type { PlanStats } from '@/utils/stats';
import { ChevronIcon, WarningIcon } from './icons';

interface Props {
  stats: PlanStats;
  favoriteCount: number;
  onOpenSelectedCourses?: () => void;
  onOpenFavorites?: () => void;
}

export default function StatsBar({
  stats,
  favoriteCount,
  onOpenSelectedCourses,
  onOpenFavorites,
}: Props) {
  return (
    <div className="stats-bar" data-tour="plan-stats">
      <button
        className="stats-bar__item stats-bar__item--button"
        type="button"
        data-tour="selected-courses-manage"
        onClick={onOpenSelectedCourses}
        disabled={!onOpenSelectedCourses}
      >
        <span className="stats-bar__label">已选课程</span>
        <span className="stats-bar__button-foot">
          <span className="stats-bar__value">
            {stats.count} <span className="stats-bar__unit">门</span>
          </span>
          <span className="stats-bar__action">
            管理
            <ChevronIcon className="stats-bar__action-icon" />
          </span>
        </span>
      </button>
      <button
        className="stats-bar__item stats-bar__item--button"
        type="button"
        data-tour="favorites-manage"
        onClick={onOpenFavorites}
        disabled={!onOpenFavorites}
      >
        <span className="stats-bar__label">收藏项目</span>
        <span className="stats-bar__button-foot">
          <span className="stats-bar__value">
            {favoriteCount} <span className="stats-bar__unit">项</span>
          </span>
          <span className="stats-bar__action">
            管理
            <ChevronIcon className="stats-bar__action-icon" />
          </span>
        </span>
      </button>
      <div className="stats-bar__item stats-bar__item--workload">
        <span className="stats-bar__label">总学分 / 学时</span>
        <span className="stats-bar__value">
          {stats.totalCredits}<span className="stats-bar__separator"> / </span>{stats.totalHours}
        </span>
      </div>
      <div className="stats-bar__item">
        <span className="stats-bar__label">冲突课程</span>
        <span className={`stats-bar__value${stats.conflictCount > 0 ? ' stats-bar__value--conflict' : ''}`}>
          {stats.conflictCount > 0 ? <WarningIcon className="stats-bar__warning-icon" /> : null}
          {stats.conflictCount} <span className="stats-bar__unit">门</span>
        </span>
      </div>
    </div>
  );
}
