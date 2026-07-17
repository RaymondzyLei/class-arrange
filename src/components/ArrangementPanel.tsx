import type { ReactNode } from 'react';
import { Tag } from 'antd';
import type { Arrangement } from '@/types';

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
  onShowRecommended: () => void;
  onLoadAllConflictFree: () => void;
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
  onShowRecommended,
  onLoadAllConflictFree,
}: Props) {
  const conflictFreeMode = mode === 'conflict-free';
  const allLoaded = allConflictFreePhase === 'ready';
  const loadingAll = allConflictFreePhase === 'loading';
  return (
    <div className="arrangement-panel">
      <div className="arrangement-panel__head">
        <span className="arrangement-panel__title">排课方案</span>
        {status}
        <button
          type="button"
          className="arrangement-panel__mode-action"
          onClick={conflictFreeMode ? onShowRecommended : onShowConflictFree}
        >
          {conflictFreeMode ? '返回推荐方案' : '展示所有不冲突方案'}
        </button>
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
            const applied = a.id === selectedId;
            const conflictFree = a.conflictCount === 0;
            return (
              <button
                key={index}
                type="button"
                className={`arrangement-card${applied ? ' arrangement-card--applied' : ''}`}
                onClick={() => onSelect(a.id)}
                aria-label={`排课方案 ${index}`}
              >
                <div className="arrangement-card__row">
                  <span className="arrangement-card__idx">#{index}</span>
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
            );
          })}
        </div>
      ) : (
        <div className="arrangement-panel__empty">
          {conflictFreeMode ? '没有不冲突的排课方案' : '没有可展示的排课方案'}
        </div>
      )}
      {conflictFreeMode ? (
        <div className="arrangement-panel__footer">
          {totalConflictFreeCount > 100 ? (
            <>
              共 {totalConflictFreeCount} 种不冲突方案，
              {allLoaded ? '已全部展示。' : loadingAll ? (
                <span>正在加载全部方案…</span>
              ) : (
                <>
                  <button
                    type="button"
                    className="arrangement-panel__load-all"
                    onClick={onLoadAllConflictFree}
                  >
                    全部展示
                  </button>
                  。
                </>
              )}
            </>
          ) : (
            <>共 {totalConflictFreeCount} 种不冲突方案</>
          )}
          {allConflictFreePhase === 'error' && allConflictFreeError ? (
            <span className="arrangement-panel__load-error">{allConflictFreeError}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
