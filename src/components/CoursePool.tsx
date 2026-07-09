import { App, Empty } from 'antd';
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from 'react-window';
import { usePlans } from '@/store/plansContext';
import { getCourseById } from '@/data';
import { buildCourseGroups } from '@/utils/courseGroup';
import { detectConflicts } from '@/utils/conflict';
import type { CourseGroup } from '@/types';
import CoursePoolItem from './CoursePoolItem';

interface Props {
  groups: CourseGroup[];
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
  observeRowElements: (elements: Element[] | NodeListOf<Element>) => () => void;
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
  observeRowElements,
}: RowComponentProps<RowExtraProps>) {
  const g = groups[index];
  const rowStyle: CSSProperties = {
    ...(style as CSSProperties),
    paddingBottom: ROW_GAP,
    boxSizing: 'border-box',
    display: 'flex',
  };
  return (
    <div
      style={rowStyle}
      {...ariaAttributes}
      ref={(node) => {
        if (!node) return undefined;
        return observeRowElements([node]);
      }}
    >
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

const DEFAULT_ROW_HEIGHT = 150;
const ROW_GAP = 4;

export default function CoursePool({ groups, selectedIds, conflictGroupKeys, themeMode, onOpenDetail }: Props) {
  const { activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const listRef = useListRef(null);
  const rowHeightKey = useMemo(() => groups.map((group) => group.key).join('|'), [groups]);
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    key: `${themeMode}:${rowHeightKey}`,
  });

  // 筛选条件或活动方案真正变更时滚回顶部。
  // 仅当列表/活动方案引用变化才触发，避免主题切换等无关 re-render 时
  // 把用户滚动到的位置意外重置。
  const lastGroupsRef = useRef(groups);
  const lastPlanIdRef = useRef(activePlan?.id);
  useEffect(() => {
    const groupsChanged = lastGroupsRef.current !== groups;
    const planChanged = lastPlanIdRef.current !== activePlan?.id;
    lastGroupsRef.current = groups;
    lastPlanIdRef.current = activePlan?.id;
    if (groupsChanged || planChanged) {
      listRef.current?.scrollToRow({ index: 0 });
    }
  }, [groups, activePlan?.id, listRef]);

  const toggle = useCallback((group: CourseGroup) => {
    if (!activePlan) {
      message.warning('请先新建一个方案');
      return;
    }
    const allSelected = group.sectionIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      dispatch({ type: 'removeCourses', courseIds: group.sectionIds });
      message.success(`已移除「${group.courseName}」`);
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
    groups,
    selectedIds,
    conflictGroupKeys,
    themeMode,
    onToggleRow: toggle,
    onOpenDetailRow: onOpenDetail,
    observeRowElements: rowHeight.observeRowElements,
  }), [groups, selectedIds, conflictGroupKeys, themeMode, toggle, onOpenDetail, rowHeight.observeRowElements]);

  // rowProps 一旦变化需要被 List 自动观察到（react-window 2.x 自动）
  return (
    <div className="panel-inner course-pool no-print" data-tour="search-results">
      {groups.length === 0 ? (
        <Empty description="无匹配课程" style={{ marginTop: 40 }} />
      ) : (
        <div className="course-pool__list">
          <List<RowExtraProps>
            listRef={listRef}
            rowCount={groups.length}
            rowHeight={rowHeight}
            rowComponent={PoolRow}
            rowProps={rowProps}
            overscanCount={6}
            style={{ height: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
