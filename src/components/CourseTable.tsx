import { Segmented, Empty } from 'antd';
import type { CourseGroup } from '@/types';
import type { ConflictMap } from '@/utils/conflict';
import { useWeekGrid } from '@/hooks/useWeekGrid';
import { DAYS, PERIODS, DAY_LABELS } from '@/constants/grid';
import CourseTableCell from './CourseTableCell';

interface Props {
  week: number;
  setWeek: (w: number) => void;
  weeks: number[];
  groups: CourseGroup[];
  conflicts: ConflictMap;
  onOpenDetail: (id: string) => void;
}

/** 把 1~13 节划为三段：1~5 / 6~10 / 11~13 */
function bandFor(period: number): 'morning' | 'noon' | 'evening' {
  if (period <= 5) return 'morning';
  if (period <= 10) return 'noon';
  return 'evening';
}

export default function CourseTable({ week, setWeek, weeks, groups, conflicts, onOpenDetail }: Props) {
  const grid = useWeekGrid(groups, week);

  // 该周是否有任何课
  const hasAny = grid.some((col) => col.some((cell) => cell.entries.length > 0));

  return (
    <div className="panel-inner course-table-wrap">
      {/* 打印标题：平时隐藏，打印时显示 */}
      <div className="print-title">
        {groups.length ? `已选 ${groups.length} 门` : ''} · 第 {week} 周
      </div>

      <div className="course-table__header no-print">
        <span className="course-table__header-label">当前周次</span>
        <Segmented
          className="week-segmented"
          value={week}
          onChange={(v) => setWeek(v as number)}
          options={weeks.map((w) => ({ label: String(w), value: w }))}
        />
        <span className="course-table__header-hint">
          固定 1~13 节 · 周一至周日
        </span>
      </div>

      {!hasAny ? (
        <Empty description={`第 ${week} 周无已选课程`} style={{ marginTop: 60 }} />
      ) : (
        <table className="course-table">
          <thead>
            <tr>
              <th className="course-table__period-head">节</th>
              {DAYS.map((d) => (
                <th
                  key={d}
                  className={`course-table__day-head${d >= 6 ? ' course-table__day-head--weekend' : ''}`}
                >
                  {DAY_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p} className="course-table__row" data-band={bandFor(p)}>
                <td className="course-table__period-cell">{p}</td>
                {DAYS.map((d) => (
                  <CourseTableCell
                    key={`${d}-${p}`}
                    cell={grid[d - 1][p - 1]}
                    week={week}
                    conflicts={conflicts}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
