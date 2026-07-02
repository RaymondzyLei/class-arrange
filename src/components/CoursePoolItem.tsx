import { Button, Tag, Tooltip } from 'antd';
import type { CourseSection } from '@/types';
import { formatWeeks } from '@/utils/weeks';

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

  return (
    <div
      className="pool-item"
      style={{
        border: '1px solid var(--border)',
        borderLeft: conflicting ? '3px solid var(--conflict)' : '3px solid transparent',
        borderRadius: 4,
        padding: '6px 8px',
        background: conflicting ? 'var(--conflict-bg)' : '#fff',
        cursor: 'pointer',
      }}
      onClick={onOpenDetail}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <Tooltip title={section.id}>
          <span style={{ fontWeight: 500, fontSize: 13 }}>
            {section.courseName}
            {conflicting && <Tag color="error" style={{ marginLeft: 6, fontSize: 11 }}>冲突</Tag>}
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
      <div style={{ color: 'var(--text-sub)', fontSize: 12, marginTop: 2 }}>
        {section.teacher || '教师未定'} · {section.department.name} · {section.credits}学分
      </div>
      <Tooltip title={section.rawSchedule || scheduleSummary}>
        <div style={{ color: 'var(--text-sub)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {scheduleSummary}
        </div>
      </Tooltip>
    </div>
  );
}
