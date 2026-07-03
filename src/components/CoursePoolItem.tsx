import { Button, Tooltip } from 'antd';
import { memo, useMemo, type CSSProperties } from 'react';
import type { CourseGroup } from '@/types';
import { formatWeeks } from '@/utils/weeks';
import { courseColor } from '@/utils/courseColor';

interface Props {
  group: CourseGroup;
  selected: boolean;
  conflicting: boolean;
  theme: 'light' | 'dark';
  onToggle: () => void;
  onOpenDetail: () => void;
}

function CoursePoolItem({ group, selected, conflicting, theme, onToggle, onOpenDetail }: Props) {
  const rep = group.sections[0];
  const scheduleSummary = group.schedule.length
    ? group.schedule
        .map((s) => `${formatWeeks(s.weeks)} 周${'一二三四五六日'[s.day - 1]}${s.periods[0]}-${s.periods[s.periods.length - 1]}@${s.room || '?'}`)
        .join('；')
    : '时间未定';

  // 主题由父层传入，与 React 订阅对齐（同步 DOM 读取已被 cache 彻底替代）
  const color = useMemo(() => courseColor(group.key, theme), [group.key, theme]);

  const cls = ['pool-item'];
  if (selected && !conflicting) cls.push('pool-item--selected');
  if (conflicting) cls.push('pool-item--conflict');

  const style: CSSProperties = {
    borderLeftColor: conflicting ? 'var(--conflict)' : color.stripe,
  };

  /** 课程号标签：单班组直接展示完整 section.id（如 `001101.01`），
   *  多班组用 `courseCode.(01,02)` 这种折叠形式 */
  const courseCodeLabel = group.sections.length > 1
    ? `${group.courseCode}.(${group.sectionIds
        .map((id) => id.slice(id.lastIndexOf('.') + 1))
        .sort()
        .join(',')})`
    : group.sectionIds[0];

  /** 老师行：多老师时全部 join 出来，单老师直接显示 */
  const teacherLine = group.teachers.length
    ? group.teachers.join('、')
    : '教师未定';

  const tooltipTitle = group.sections.length > 1
    ? `${group.courseName}（${group.sectionIds.length} 个班次：${group.teachers.join('、')}）`
    : group.sectionIds[0];

  return (
    <div
      className={cls.join(' ')}
      style={style}
      onClick={onOpenDetail}
    >
      <div className="pool-item__head">
        <Tooltip title={tooltipTitle}>
          <span className="pool-item__name">
            <span className="pool-item__name-text">{group.courseName}</span>
            {group.sections.length > 1 && (
              <span className="pool-item__count-tag">{group.sections.length}班</span>
            )}
            {conflicting && <span className="pool-item__conflict-tag">冲突</span>}
          </span>
        </Tooltip>
        <Button
          size="small"
          type={selected ? 'primary' : 'default'}
          danger={selected}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {selected ? '移出' : '加入'}
        </Button>
      </div>
      <div className="pool-item__code-row">
        <span className="pool-item__course-code">{courseCodeLabel}</span>
        <span className="pool-item__meta-aside">
          {rep?.department.name ?? ''} · {rep?.credits ?? 0}学分
        </span>
      </div>
      <div className="pool-item__teacher-row">{teacherLine}</div>
      <Tooltip title={rep?.rawSchedule || scheduleSummary}>
        <div className="pool-item__schedule">{scheduleSummary}</div>
      </Tooltip>
    </div>
  );
}

export default memo(CoursePoolItem);
