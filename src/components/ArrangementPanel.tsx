import type { ReactNode } from 'react';
import { Tag } from 'antd';
import type { Arrangement } from '@/types';
import { FavoriteButton } from './FavoriteButton';

interface Props {
  arrangements: Arrangement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  status: ReactNode;
  mode: 'recommended' | 'conflict-free';
  totalConflictFreeCount: number;
  allConflictFreePhase: 'idle' | 'loading' | 'ready' | 'error';
  allConflictFreeError: string | null;
  onShowConflictFree: () => void;
  favoriteIds: ReadonlySet<string>;
  numbersById: ReadonlyMap<string, number>;
  onToggleFavorite: (arrangement: Arrangement, number: number) => void;
}

export default function ArrangementPanel({
  arrangements,
  selectedId,
  onSelect,
  status,
  mode,
  totalConflictFreeCount,
  allConflictFreePhase,
  allConflictFreeError,
  onShowConflictFree,
  favoriteIds,
  numbersById,
  onToggleFavorite,
}: Props) {
  const conflictFreeMode = mode === 'conflict-free';
  const loadingAll = allConflictFreePhase === 'loading';
  return (
    <div className="arrangement-panel" data-tour="arrangement-preview">
      <div className="arrangement-panel__head">
        <span className="arrangement-panel__title">排课方案</span>
        {status}
      </div>
      {arrangements.length > 0 ? (
        <div
          className={`arrangement-panel__list${
            arrangements.length > 4 ? ' arrangement-panel__list--scroll' : ''
          }${
            arrangements.length > 2 ? ' arrangement-panel__list--mobile-scroll' : ''
          }`}
        >
          {arrangements.map((a, index) => {
            const number = numbersById.get(a.id) ?? index;
            const applied = a.id === selectedId;
            const conflictFree = a.conflictCount === 0;
            const favorite = favoriteIds.has(a.id);
            return (
              <div className="arrangement-card-wrap" key={a.id}>
                <button
                  type="button"
                  className={`arrangement-card${applied ? ' arrangement-card--applied' : ''}`}
                  onClick={() => onSelect(a.id)}
                  aria-label={`排课方案 ${number}`}
                >
                  <div className="arrangement-card__row">
                    <span className="arrangement-card__idx">#{number}</span>
                    <span className="arrangement-card__meta">
                      {a.courseCount} 门 · {a.totalCredits} 学分
                    </span>
                    <Tag
                      color={conflictFree ? 'green' : 'orange'}
                      className="arrangement-card__conflict"
                    >
                      {conflictFree ? '无冲突' : `${a.conflictCount} 冲突`}
                    </Tag>
                  </div>
                </button>
                <FavoriteButton
                  className="arrangement-card__favorite"
                  active={favorite}
                  label={`${favorite ? '取消收藏' : '收藏'}排课方案 #${number}`}
                  onToggle={() => onToggleFavorite(a, number)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="arrangement-panel__empty">
          {conflictFreeMode ? '没有不冲突的排课方案' : '没有可展示的排课方案'}
        </div>
      )}
      {!conflictFreeMode && totalConflictFreeCount > 0 ? (
        <div className="arrangement-panel__footer">
          共 {totalConflictFreeCount} 种不冲突方案，
          <button
            type="button"
            className="arrangement-panel__show-all"
            onClick={onShowConflictFree}
          >
            显示全部
          </button>
          。
        </div>
      ) : conflictFreeMode ? (
        <div className="arrangement-panel__footer">
          共 {totalConflictFreeCount} 种不冲突方案
          {loadingAll ? <span>，正在加载全部方案…</span> : null}
          {allConflictFreePhase === 'error' && allConflictFreeError ? (
            <span className="arrangement-panel__load-error">{allConflictFreeError}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
