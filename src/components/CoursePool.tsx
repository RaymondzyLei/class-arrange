import { App, Empty } from 'antd';
import { useCallback, useEffect, useMemo, type CSSProperties } from 'react';
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from 'react-window';
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
  themeMode: 'light' | 'dark';
  onOpenDetail: (groupKey: string) => void;
}

/** react-window 2.x: List <RowProps> 的"单元格 props"。
 *  用单一稳定对象把列表渲染所需的数据传给 Row，避免父组件 inline 新建回调。 */
interface RowExtraProps {
  groups: CourseGroup[];
  selectedIds: Set<string>;
  conflictGroupKeys: Set<string>;
  themeMode: 'light' | 'dark';
  onToggleRow: (group: CourseGroup) => void;
  onOpenDetailRow: (groupKey: string) => void;
  dynamicRowHeight: ReturnType<typeof useDynamicRowHeight>;
  defaultRowHeight: number;
}

function PoolRow({
  index,
  style,
  ariaAttributes,
  groups,
  selectedIds,
  conflictGroupKeys,
  themeMode,
  onToggleRow,
  onOpenDetailRow,
  dynamicRowHeight,
  defaultRowHeight,
}: RowComponentProps<RowExtraProps>) {
  const g = groups[index];
  // react-window 2.x 的 useDynamicRowHeight 通过 ResizeObserver 测量
  // `borderBoxSize` —— padding 的尺寸已经包含在内。因此 minHeight 直接用
  // 测量结果，paddingBottom 只是视觉效果，不会重复计入。
  const measured = dynamicRowHeight.getRowHeight(index);
  const minH = measured ?? defaultRowHeight;
  const rowStyle: CSSProperties = {
    ...(style as CSSProperties),
    minHeight: minH,
    height: 'auto',
    paddingBottom: ROW_GAP,
    boxSizing: 'border-box',
  };
  return (
    <div style={rowStyle} {...ariaAttributes}>
      <CoursePoolItem
        group={g}
        selected={g.sectionIds.every((id) => selectedIds.has(id))}
        conflicting={conflictGroupKeys.has(g.key) && g.sectionIds.some((id) => selectedIds.has(id))}
        theme={themeMode}
        onToggle={() => onToggleRow(g)}
        onOpenDetail={() => onOpenDetailRow(g.key)}
      />
    </div>
  );
}

const DEFAULT_ROW_HEIGHT = 90;
/** 行之间的间距。要并入每个 row 的测量高度中，否则 react-window 会把上下卡片贴在一起 */
const ROW_GAP = 6;
const ROW_HEIGHT_WITH_GAP = DEFAULT_ROW_HEIGHT + ROW_GAP;

export default function CoursePool({ filter, selectedIds, conflictGroupKeys, themeMode, onOpenDetail }: Props) {
  const { activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const filtered = useFilteredCourses(filter);
  const listRef = useListRef(null);

  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: DEFAULT_ROW_HEIGHT });

  // 筛选/方案切换：滚回顶部
  useEffect(() => {
    listRef.current?.scrollToRow({ index: 0 });
  }, [filter, activePlan?.id, listRef]);

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

  const rowProps = useMemo<RowExtraProps>(() => ({
    groups: filtered,
    selectedIds,
    conflictGroupKeys,
    themeMode,
    onToggleRow: toggle,
    onOpenDetailRow: onOpenDetail,
    dynamicRowHeight,
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
  }), [filtered, selectedIds, conflictGroupKeys, themeMode, toggle, onOpenDetail, dynamicRowHeight]);

  // rowProps 一旦变化需要被 List 自动观察到（react-window 2.x 自动）
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
            <List<RowExtraProps>
              listRef={listRef}
              rowCount={filtered.length}
              rowHeight={dynamicRowHeight}
              rowComponent={PoolRow}
              rowProps={rowProps}
              overscanCount={6}
              style={{ height: '100%' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
