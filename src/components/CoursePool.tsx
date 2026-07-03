import { App, Empty } from 'antd';
import { List, type RowComponentProps, type ListImperativeAPI } from 'react-window';
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useFilteredCourses } from '@/hooks/useFilteredCourses';
import { usePlans } from '@/store/plansContext';
import { getCourseById } from '@/data';
import { buildCourseGroups } from '@/utils/courseGroup';
import { detectConflicts } from '@/utils/conflict';
import type { CourseGroup, FilterState } from '@/types';
import CoursePoolItem from './CoursePoolItem';

/** 每个池项的固定高度（含 padding + border + gap） */
const ITEM_HEIGHT = 96;

interface Props {
  filter: FilterState;
  selectedIds: Set<string>;
  conflictGroupKeys: Set<string>;
  onOpenDetail: (groupKey: string) => void;
}

/** 传给 rowComponent 的自定义 props */
interface RowOwnProps {
  groups: CourseGroup[];
  selectedIds: Set<string>;
  conflictGroupKeys: Set<string>;
  onToggle: (group: CourseGroup) => void;
  onOpenDetail: (groupKey: string) => void;
}

function PoolRow({ index, style, groups, selectedIds, conflictGroupKeys, onToggle, onOpenDetail }: RowComponentProps<RowOwnProps>) {
  const g = groups[index];
  return (
    <div style={{ ...(style as CSSProperties), paddingBottom: 6 }}>
      <CoursePoolItem
        group={g}
        selected={g.sectionIds.every((id) => selectedIds.has(id))}
        conflicting={conflictGroupKeys.has(g.key) && g.sectionIds.some((id) => selectedIds.has(id))}
        onToggle={() => onToggle(g)}
        onOpenDetail={() => onOpenDetail(g.key)}
      />
    </div>
  );
}

export default function CoursePool({ filter, selectedIds, conflictGroupKeys, onOpenDetail }: Props) {
  const { activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const filtered = useFilteredCourses(filter);
  const listRef = useRef<ListImperativeAPI>(null);

  // 筛选变化时滚动回顶部
  useEffect(() => {
    listRef.current?.scrollToRow({ index: 0 });
  }, [filter]);

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

  const rowProps = useMemo<RowOwnProps>(() => ({
    groups: filtered,
    selectedIds,
    conflictGroupKeys,
    onToggle: toggle,
    onOpenDetail,
  }), [filtered, selectedIds, conflictGroupKeys, toggle, onOpenDetail]);

  return (
    <div className="panel-inner course-pool no-print">
      {filtered.length === 0 ? (
        <Empty description="无匹配课程" style={{ marginTop: 40 }} />
      ) : (
        <>
          <div className="course-pool__count">
            共 {filtered.length} 门
          </div>
          <List<RowOwnProps>
            listRef={listRef}
            rowCount={filtered.length}
            rowHeight={ITEM_HEIGHT}
            rowComponent={PoolRow}
            rowProps={rowProps}
            overscanCount={8}
          />
        </>
      )}
    </div>
  );
}
