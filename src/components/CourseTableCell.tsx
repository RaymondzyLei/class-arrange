import type { GridCell } from '@/utils/grid';
import type { ConflictMap } from '@/utils/conflict';
import { getCourseById } from '@/data';
import { DAY_LABELS } from '@/constants/grid';
import { courseColorIndex } from '@/utils/courseColor';

/** 同一格内课程块数超过此值时折叠为 +N */
const COLLAPSE_THRESHOLD = 3;
/** 折叠时显示前 N 条 */
const COLLAPSE_SHOW = 2;

interface Props {
  cell: GridCell;
  week: number;
  conflicts: ConflictMap;
  onOpenDetail: (id: string) => void;
}

export default function CourseTableCell({ cell, week, conflicts, onOpenDetail }: Props) {
  if (cell.entries.length === 0) {
    return <td className="course-table__cell course-table__cell--empty" />;
  }

  const slotKey = `${week}-${cell.day}-${cell.period}`;
  const isConflict = conflicts.has(slotKey);

  const classes = ['course-table__cell', 'course-table__cell--has'];
  if (isConflict) classes.push('course-table__cell--conflict');

  const visible = cell.entries.length > COLLAPSE_THRESHOLD
    ? cell.entries.slice(0, COLLAPSE_SHOW)
    : cell.entries;
  const overflow = cell.entries.length - visible.length;

  return (
    <td
      className={classes.join(' ')}
      onClick={() => onOpenDetail(cell.entries[0].courseId)}
      title={isConflict ? '存在时间冲突' : undefined}
    >
      <div className="course-blocks">
        {visible.map((e, i) => {
          const c = getCourseById(e.courseId);
          if (!c) return null;
          const colorIdx = courseColorIndex(e.courseId);
          const title = `${c.courseName}${e.slot.room ? ` @${e.slot.room}` : ''} · ${DAY_LABELS[cell.day]} 第${e.slot.periods.join('/')}节`;
          return (
            <div
              key={`${e.courseId}-${i}`}
              className={`course-block course-block--color-${colorIdx}`}
              title={title}
            >
              <div className="course-block__name">{c.courseName}</div>
              {e.slot.room ? <div className="course-block__room">@{e.slot.room}</div> : null}
            </div>
          );
        })}
        {overflow > 0 ? (
          <div className="course-block course-block--overflow" title={`还有 ${overflow} 门课程`}>
            +{overflow}
          </div>
        ) : null}
      </div>
    </td>
  );
}