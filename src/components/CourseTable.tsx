import { Select, Typography, Empty } from 'antd';
import type { Plan } from '@/types';
import type { ConflictMap } from '@/utils/conflict';
import { useWeekGrid } from '@/hooks/useWeekGrid';
import { DAYS, PERIODS, DAY_LABELS } from '@/constants/grid';
import CourseTableCell from './CourseTableCell';

interface Props {
  week: number;
  setWeek: (w: number) => void;
  weeks: number[];
  activePlan: Plan | null;
  conflicts: ConflictMap;
  onOpenDetail: (id: string) => void;
}

export default function CourseTable({ week, setWeek, weeks, activePlan, conflicts, onOpenDetail }: Props) {
  const grid = useWeekGrid(activePlan, week);

  // 该周是否有任何课
  const hasAny = grid.some((col) => col.some((cell) => cell.entries.length > 0));

  return (
    <div className="panel-inner" style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column' }}>
      {/* 打印标题：平时隐藏，打印时显示 */}
      <div className="print-title">
        {activePlan?.name ?? ''} · 第 {week} 周
      </div>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Typography.Text>当前周次</Typography.Text>
        <Select
          value={week}
          onChange={setWeek}
          style={{ width: 110 }}
          options={weeks.map((w) => ({ label: `第 ${w} 周`, value: w }))}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          固定 1~13 节，周一至周日
        </Typography.Text>
      </div>
      {!hasAny ? (
        <Empty description={`第 ${week} 周无已选课程`} style={{ marginTop: 60 }} />
      ) : (
        <table className="course-table" style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 44, border: '1px solid var(--border)', background: '#fafafa' }}>节</th>
              {DAYS.map((d) => (
                <th key={d} style={{ border: '1px solid var(--border)', background: '#fafafa', padding: 4 }}>
                  {DAY_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p} style={{ height: 36 }}>
                <td style={{ border: '1px solid var(--border)', background: '#fafafa', textAlign: 'center', fontSize: 12, color: 'var(--text-sub)' }}>
                  {p}
                </td>
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
