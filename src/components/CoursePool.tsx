import { App, Empty } from 'antd';
import { List, type RowComponentProps, type ListImperativeAPI } from 'react-window';
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useFilteredCourses } from '@/hooks/useFilteredCourses';
import { usePlans } from '@/store/plansContext';
import { getCourseById } from '@/data';
import { detectConflicts } from '@/utils/conflict';
import type { CourseSection, FilterState } from '@/types';
import CoursePoolItem from './CoursePoolItem';

/** 每个池项的固定高度（含 padding + border + gap） */
const ITEM_HEIGHT = 78;

interface Props {
  filter: FilterState;
  selectedIds: Set<string>;
  conflictIds: Set<string>;
  onOpenDetail: (id: string) => void;
}

/** 传给 rowComponent 的自定义 props */
interface RowOwnProps {
  courses: CourseSection[];
  selectedIds: Set<string>;
  conflictIds: Set<string>;
  onToggle: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

function PoolRow({ index, style, courses, selectedIds, conflictIds, onToggle, onOpenDetail }: RowComponentProps<RowOwnProps>) {
  const c = courses[index];
  return (
    <div style={{ ...(style as CSSProperties), paddingBottom: 6 }}>
      <CoursePoolItem
        section={c}
        selected={selectedIds.has(c.id)}
        conflicting={conflictIds.has(c.id) && selectedIds.has(c.id)}
        onToggle={() => onToggle(c.id)}
        onOpenDetail={() => onOpenDetail(c.id)}
      />
    </div>
  );
}

export default function CoursePool({ filter, selectedIds, conflictIds, onOpenDetail }: Props) {
  const { activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const filtered = useFilteredCourses(filter);
  const listRef = useRef<ListImperativeAPI>(null);

  // 筛选变化时滚动回顶部
  useEffect(() => {
    listRef.current?.scrollToRow({ index: 0 });
  }, [filter]);

  const toggle = useCallback((id: string) => {
    if (!activePlan) {
      message.warning('请先新建一个方案');
      return;
    }
    if (selectedIds.has(id)) {
      dispatch({ type: 'removeCourse', courseId: id });
      return;
    }
    const sec = getCourseById(id);
    if (sec) {
      const existing = activePlan.courseIds
        .map((cid) => getCourseById(cid))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      const map = detectConflicts([...existing, sec]);
      const conflictWithNew = new Set<string>();
      for (const set of map.values()) {
        if (set.has(id)) for (const x of set) conflictWithNew.add(x);
      }
      if (conflictWithNew.size > 0) {
        const names = [...conflictWithNew]
          .filter((x) => x !== id)
          .map((x) => getCourseById(x)?.courseName ?? x)
          .slice(0, 3)
          .join('、');
        message.warning(`与已选课程存在时间冲突：${names}（仍已加入）`);
      } else {
        message.success(`已加入「${sec.courseName}」`);
      }
    }
    dispatch({ type: 'addCourse', courseId: id });
  }, [activePlan, selectedIds, dispatch, message]);

  const rowProps = useMemo<RowOwnProps>(() => ({
    courses: filtered,
    selectedIds,
    conflictIds,
    onToggle: toggle,
    onOpenDetail,
  }), [filtered, selectedIds, conflictIds, toggle, onOpenDetail]);

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
