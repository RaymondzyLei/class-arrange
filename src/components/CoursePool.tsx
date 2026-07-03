import { App, Empty } from 'antd';
import { useCallback } from 'react';
import { useFilteredCourses } from '@/hooks/useFilteredCourses';
import { usePlans } from '@/store/plansContext';
import { getCourseById } from '@/data';
import { buildCourseGroups } from '@/utils/courseGroup';
import { detectConflicts } from '@/utils/conflict';
import type { CourseGroup, FilterState } from '@/types';
import CoursePoolItem from './CoursePoolItem';

interface Props {
  filter: FilterState;
  selectedIds: Set<string>;
  conflictGroupKeys: Set<string>;
  onOpenDetail: (groupKey: string) => void;
}

export default function CoursePool({ filter, selectedIds, conflictGroupKeys, onOpenDetail }: Props) {
  const { activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const filtered = useFilteredCourses(filter);

  const toggle = useCallback((group: CourseGroup) => {
    if (!activePlan) {
      message.warning('请先新建一个方案');
      return;
    }
    const allSelected = group.sectionIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      dispatch({ type: 'removeCourses', courseIds: group.sectionIds });
      return;
    }
    // 冲突预检：把已选 sections + 本组 sections 聚合成 groups 再检测
    const existing = activePlan.courseIds
      .map((cid) => getCourseById(cid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const previewSections = [...existing, ...group.sections];
    const previewGroups = buildCourseGroups(previewSections);
    const map = detectConflicts(previewGroups);
    const conflictWithNew = new Set<string>();
    for (const set of map.values()) {
      if (set.has(group.key)) for (const x of set) conflictWithNew.add(x);
    }
    if (conflictWithNew.size > 0) {
      const names = [...conflictWithNew]
        .filter((x) => x !== group.key)
        .map((x) => {
          const g = previewGroups.find((gg) => gg.key === x);
          return g?.courseName ?? x;
        })
        .slice(0, 3)
        .join('、');
      message.warning(`与已选课程存在时间冲突：${names}（仍已加入）`);
    } else {
      message.success(`已加入「${group.courseName}」`);
    }
    dispatch({ type: 'addCourses', courseIds: group.sectionIds });
  }, [activePlan, selectedIds, dispatch, message]);

  return (
    <div className="panel-inner course-pool no-print">
      {filtered.length === 0 ? (
        <Empty description="无匹配课程" style={{ marginTop: 40 }} />
      ) : (
        <>
          <div className="course-pool__count">
            共 {filtered.length} 门
          </div>
          <div className="course-pool__list">
            {filtered.map((g) => (
              <CoursePoolItem
                key={g.key}
                group={g}
                selected={g.sectionIds.every((id) => selectedIds.has(id))}
                conflicting={conflictGroupKeys.has(g.key) && g.sectionIds.some((id) => selectedIds.has(id))}
                onToggle={() => toggle(g)}
                onOpenDetail={() => onOpenDetail(g.key)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
