import type { GridCell } from '@/utils/grid';
import type { ConflictMap } from '@/utils/conflict';
import { courseColorIndex } from '@/utils/courseColor';

/** 同一格内课程块数超过此值时折叠为 +N */
const COLLAPSE_THRESHOLD = 3;
/** 折叠时显示前 N 条 */
const COLLAPSE_SHOW = 2;

interface Props {
  cell: GridCell;
  week: number;
  conflicts: ConflictMap;
  onOpenDetail: (groupKey: string) => void;
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
      onClick={() => onOpenDetail(cell.entries[0].groupKey)}
    >
      <div className="course-blocks">
        {visible.map((e, i) => {
          const colorIdx = courseColorIndex(e.groupKey);
          // 多班组同时间班次地点不唯一，课表单元格折叠时不显示教室
          const showRoom = !e.isMultiSection && !!e.slot.room;
          return (
            <div
              key={`${e.groupKey}-${i}`}
              className={`course-block course-block--color-${colorIdx}`}
            >
              <div className="course-block__name">{e.courseName}</div>
              {showRoom ? <div className="course-block__room">@{e.slot.room}</div> : null}
            </div>
          );
        })}
        {overflow > 0 ? (
          <div className="course-block course-block--overflow">
            +{overflow}
          </div>
        ) : null}
      </div>
    </td>
  );
}
