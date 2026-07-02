import type { GridCell } from '@/utils/grid';
import type { ConflictMap } from '@/utils/conflict';
import { getCourseById } from '@/data';
import { DAY_LABELS } from '@/constants/grid';

interface Props {
  cell: GridCell;
  week: number;
  conflicts: ConflictMap;
  onOpenDetail: (id: string) => void;
}

export default function CourseTableCell({ cell, week, conflicts, onOpenDetail }: Props) {
  if (cell.entries.length === 0) {
    return <td className="cell-empty" />;
  }
  const slotKey = `${week}-${cell.day}-${cell.period}`;
  const isConflict = conflicts.has(slotKey);
  // 同一格若多门课，全部显示并标红
  return (
    <td
      className={isConflict ? 'cell-entry cell-conflict' : 'cell-entry'}
      onClick={() => onOpenDetail(cell.entries[0].courseId)}
      style={{ cursor: 'pointer', padding: 3 }}
    >
      {cell.entries.map((e, i) => {
        const c = getCourseById(e.courseId);
        if (!c) return null;
        return (
          <div
            key={`${e.courseId}-${i}`}
            style={{
              fontSize: 11,
              lineHeight: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`${c.courseName} @${e.slot.room || ''} ${DAY_LABELS[cell.day]}${e.slot.periods.join(',')}`}
          >
            {c.courseName}
            {e.slot.room ? `@${e.slot.room}` : ''}
          </div>
        );
      })}
    </td>
  );
}
