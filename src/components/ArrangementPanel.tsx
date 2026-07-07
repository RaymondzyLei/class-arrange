import { Tag } from 'antd';
import type { Arrangement } from '@/types';

interface Props {
  arrangements: Arrangement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ArrangementPanel({ arrangements, selectedId, onSelect }: Props) {
  return (
    <div className="panel-inner arrangement-panel no-print">
      <div className="arrangement-panel__head">
        <span className="arrangement-panel__title">排课方案</span>
        <span className="arrangement-panel__sub">
          共 {arrangements.length} 种方案
        </span>
      </div>
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
              key={a.id}
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
    </div>
  );
}
