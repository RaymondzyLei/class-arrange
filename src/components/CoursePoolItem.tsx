import { Button, Tooltip } from 'antd';
import type { CSSProperties } from 'react';
import type { CourseGroup } from '@/types';
import { formatWeeks } from '@/utils/weeks';
import { courseColor } from '@/utils/courseColor';

interface Props {
  group: CourseGroup;
  selected: boolean;
  conflicting: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}

export default function CoursePoolItem({ group, selected, conflicting, onToggle, onOpenDetail }: Props) {
  const rep = group.sections[0];
  const scheduleSummary = group.schedule.length
    ? group.schedule
        .map((s) => `${formatWeeks(s.weeks)} 周${'一二三四五六日'[s.day - 1]}${s.periods[0]}-${s.periods[s.periods.length - 1]}@${s.room || '?'}`)
        .join('；')
    : '时间未定';

  const teacherText = group.teachers.length > 1
    ? `${group.teachers.length} 位老师`
    : group.teachers[0] || '教师未定';

  // 主题读取：localStorage 简单同步读，避免为单个组件引入完整 theme context
  const theme = (typeof window !== 'undefined' && document.documentElement.dataset.theme === 'dark')
    ? 'dark'
    : 'light';
  const color = courseColor(group.key, theme);

  const cls = ['pool-item'];
  if (selected && !conflicting) cls.push('pool-item--selected');
  if (conflicting) cls.push('pool-item--conflict');

  const style: CSSProperties = {
    borderLeftColor: conflicting ? 'var(--conflict)' : color.stripe,
  };

  /** "001101.(01,02,03)" 格式的课程号+班次后缀 */
  const courseCodeSuffix = (() => {
    if (group.sections.length <= 1) return null;
    const suffixes = group.sectionIds
      .map((id) => id.slice(id.lastIndexOf('.') + 1))
      .sort();
    return `${group.courseCode}.(${suffixes.join(',')})`;
  })();

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
      <div className="pool-item__meta">
        {courseCodeSuffix && <span className="pool-item__course-code">{courseCodeSuffix}</span>}
        {courseCodeSuffix && ' · '}
        {teacherText} · {rep?.department.name ?? ''} · {rep?.credits ?? 0}学分
      </div>
      <Tooltip title={rep?.rawSchedule || scheduleSummary}>
        <div className="pool-item__schedule">{scheduleSummary}</div>
      </Tooltip>
    </div>
  );
}
