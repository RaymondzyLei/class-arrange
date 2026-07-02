import { Button, Tooltip } from 'antd';
import type { CSSProperties } from 'react';
import type { CourseSection } from '@/types';
import { formatWeeks } from '@/utils/weeks';
import { courseColor } from '@/utils/courseColor';

interface Props {
  section: CourseSection;
  selected: boolean;
  conflicting: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}

export default function CoursePoolItem({ section, selected, conflicting, onToggle, onOpenDetail }: Props) {
  const scheduleSummary = section.schedule.length
    ? section.schedule
        .map((s) => `${formatWeeks(s.weeks)} 周${'一二三四五六日'[s.day - 1]}${s.periods[0]}-${s.periods[s.periods.length - 1]}@${s.room || '?'}`)
        .join('；')
    : '时间未定';

  // 主题读取：localStorage 简单同步读，避免为单个组件引入完整 theme context
  const theme = (typeof window !== 'undefined' && document.documentElement.dataset.theme === 'dark')
    ? 'dark'
    : 'light';
  const color = courseColor(section.id, theme);

  const cls = ['pool-item'];
  if (selected && !conflicting) cls.push('pool-item--selected');
  if (conflicting) cls.push('pool-item--conflict');

  const style: CSSProperties = {
    borderLeftColor: conflicting ? 'var(--conflict)' : color.stripe,
  };

  return (
    <div
      className={cls.join(' ')}
      style={style}
      onClick={onOpenDetail}
    >
      <div className="pool-item__head">
        <Tooltip title={section.id}>
          <span className="pool-item__name">
            <span className="pool-item__name-text">{section.courseName}</span>
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
        {section.teacher || '教师未定'} · {section.department.name} · {section.credits}学分
      </div>
      <Tooltip title={section.rawSchedule || scheduleSummary}>
        <div className="pool-item__schedule">{scheduleSummary}</div>
      </Tooltip>
    </div>
  );
}