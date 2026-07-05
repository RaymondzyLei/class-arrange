import { Button } from 'antd';
import { memo, useMemo, type CSSProperties } from 'react';
import type { CourseGroup } from '@/types';
import { courseColor } from '@/utils/courseColor';
import { getIcourseRatingInfo } from '@/utils/icourseRating';
import { formatScheduleCompact } from '@/utils/scheduleFormat';

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
  const scheduleSummary = formatScheduleCompact(group.schedule);

  // 主题由父层传入，与 React 订阅对齐（同步 DOM 读取已被 cache 彻底替代）
  const color = useMemo(() => courseColor(group.key, theme), [group.key, theme]);

  const cls = ['pool-item'];
  if (selected && !conflicting) cls.push('pool-item--selected');
  if (conflicting) cls.push('pool-item--conflict');

  const style = {
    '--pool-item-stripe': conflicting ? 'var(--conflict)' : color.stripe,
  } as CSSProperties;

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

  /** icourse 评分：仅单班次组展示，多班次组在详情弹窗里分别展示 */
  const rating = group.sections.length === 1
    ? getIcourseRatingInfo(group.sectionIds[0])
    : undefined;
  const ratingLabel = rating
    ? `${rating.score}${typeof rating.ratingCount === 'number' ? `(${rating.ratingCount})` : ''}`
    : '';

  return (
    <div
      className={cls.join(' ')}
      style={style}
      onClick={onOpenDetail}
    >
      <div className="pool-item__head">
        <span className="pool-item__name">
          <span className="pool-item__name-text">{group.courseName}</span>
          {group.sections.length > 1 && (
            <span className="pool-item__count-tag">{group.sections.length}个班</span>
          )}
          {conflicting && <span className="pool-item__conflict-tag">冲突</span>}
        </span>
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
          {rating && (
            <>
              {' · '}
              <a
                className="pool-item__rating"
                href={rating.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {ratingLabel}
              </a>
            </>
          )}
        </span>
      </div>
      <div className="pool-item__teacher-row">{teacherLine}</div>
      <div className="pool-item__schedule">{scheduleSummary}</div>
    </div>
  );
}

export default memo(CoursePoolItem);
