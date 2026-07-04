import { Tag, Tooltip } from 'antd';
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
          共 {arrangements.length} 种（按冲突数从少到多）· 点选切换
        </span>
      </div>
      <div className="arrangement-panel__list">
        {arrangements.map((a) => {
          const applied = a.id === selectedId;
          const conflictFree = a.conflictCount === 0;
          const tooltipText = a.groups.map((g) => g.courseName).join('、');
          return (
            <Tooltip key={a.id} title={tooltipText}>
              <button
                type="button"
                className={`arrangement-card${applied ? ' arrangement-card--applied' : ''}`}
                onClick={() => onSelect(a.id)}
              >
                <div className="arrangement-card__row">
                  <span className="arrangement-card__idx">{a.id.replace('arr-', '#')}</span>
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
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
