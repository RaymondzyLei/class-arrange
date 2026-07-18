import { Button } from 'antd';
import { memo, useMemo, type CSSProperties } from 'react';
import type { CourseGroup } from '@/types';
import { courseColor } from '@/utils/courseColor';
import { getIcourseRatingInfo } from '@/utils/icourseRating';
import { formatScheduleCompact } from '@/utils/scheduleFormat';
import { formatTeacherList } from '@/utils/teachers';

interface Props {
  group: CourseGroup;
  groupSelected: boolean;
  courseSelected: boolean;
  conflicting: boolean;
  theme: 'light' | 'dark';
  onToggleGroup: () => void;
  onToggleCourse: () => void;
  onOpenDetail: () => void;
}

function CoursePoolItem({
  group,
  groupSelected,
  courseSelected,
  conflicting,
  theme,
  onToggleGroup,
  onToggleCourse,
  onOpenDetail,
}: Props) {
  const rep = group.sections[0];
  const mergedTimeGroups = group.timeGroups;
  const scheduleSummary = mergedTimeGroups
    ? `共 ${mergedTimeGroups.length} 个时间组，点击查看详情`
    : formatScheduleCompact(group.schedule);

  // 主题由父层传入，与 React 订阅对齐（同步 DOM 读取已被 cache 彻底替代）
  const color = useMemo(() => courseColor(group.key, theme), [group.key, theme]);

  const cls = ['pool-item'];
  if (groupSelected && !conflicting) cls.push('pool-item--selected');
  if (conflicting) cls.push('pool-item--conflict');

  const style = {
    '--pool-item-stripe': conflicting ? 'var(--conflict)' : color.stripe,
  } as CSSProperties;

  /** 课程号标签：单班组直接展示完整 section.id（如 `001101.01`），
   *  多班组用 `courseCode.(01,02)` 这种折叠形式 */
  const courseCodeLabel = mergedTimeGroups
    ? group.courseCode
    : group.sections.length > 1
    ? `${group.courseCode}.(${group.sectionIds
        .map((id) => id.slice(id.lastIndexOf('.') + 1))
        .sort()
        .join(',')})`
    : group.sectionIds[0];

  /** 老师行：多老师时全部 join 出来，单老师直接显示 */
  const teacherLine = formatTeacherList(group.teachers);

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
          {(mergedTimeGroups || group.sections.length > 1) && (
            <span className="pool-item__count-tag">
              {mergedTimeGroups
                ? `${mergedTimeGroups.length}个时间组 · ${group.sections.length}个班`
                : `${group.sections.length}个班`}
            </span>
          )}
          {conflicting && <span className="pool-item__conflict-tag">冲突</span>}
        </span>
        <div className="pool-item__actions">
          {!mergedTimeGroups ? (
            <Button
              size="small"
              type={groupSelected ? 'default' : 'primary'}
              danger={groupSelected}
              aria-label={`${groupSelected ? '移除此时间组' : '选择此时间组'}：${group.courseName}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleGroup();
              }}
            >
              {groupSelected ? '移除此时间组' : '选择此时间组'}
            </Button>
          ) : null}
          <Button
            size="small"
            type={courseSelected ? 'default' : 'primary'}
            danger={courseSelected}
            aria-label={`${courseSelected ? '移除全部时间组' : '选择全部时间组'}：${group.courseName}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCourse();
            }}
          >
            {courseSelected ? '移除全部时间组' : '选择全部时间组'}
          </Button>
        </div>
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
