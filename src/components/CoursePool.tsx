import { App, Empty } from 'antd';
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from 'react-window';
import { usePlans } from '@/store/plansContext';
import { buildCourseGroups } from '@/utils/courseGroup';
import {
  conflictingCourseNamesForSelection,
  idsForCourse,
  idsForGroup,
} from '@/utils/courseSelection';
import type { CourseGroup, CourseSection } from '@/types';
import CoursePoolItem from './CoursePoolItem';
import { useFavorites } from '@/favorites/FavoritesContext';
import type { FavoriteKind } from '@/types';

interface Props {
  groups: CourseGroup[];
  selectedIds: Set<string>;
  conflictGroupKeys: Set<string>;
  themeMode: 'light' | 'dark';
  onOpenDetail: (groupKey: string) => void;
  courseMap: ReadonlyMap<string, CourseSection>;
  groupsByCode: ReadonlyMap<string, CourseGroup[]>;
}

/** react-window 2.x: List <RowProps> 的"单元格 props"。
 *  用单一稳定对象把列表渲染所需的数据传给 Row，避免父组件 inline 新建回调。 */
interface RowExtraProps {
  groups: CourseGroup[];
  selectedIds: Set<string>;
  groupsByCode: ReadonlyMap<string, CourseGroup[]>;
  conflictGroupKeys: Set<string>;
  themeMode: 'light' | 'dark';
  favoriteIds: ReadonlySet<string>;
  toggleFavorite: (kind: FavoriteKind, id: string) => void;
  onToggleGroupRow: (group: CourseGroup) => void;
  onToggleCourseRow: (group: CourseGroup) => void;
  onOpenDetailRow: (groupKey: string) => void;
  observeRowElements: (elements: Element[] | NodeListOf<Element>) => () => void;
}

function PoolRow({
  index,
  style,
  ariaAttributes,
  groups,
  selectedIds,
  groupsByCode,
  conflictGroupKeys,
  themeMode,
  favoriteIds,
  toggleFavorite,
  onToggleGroupRow,
  onToggleCourseRow,
  onOpenDetailRow,
  observeRowElements,
}: RowComponentProps<RowExtraProps>) {
  const group = groups[index];
  const rowStyle: CSSProperties = {
    ...(style as CSSProperties),
    paddingBottom: ROW_GAP,
    boxSizing: 'border-box',
    display: 'flex',
  };
  const groupIds = idsForGroup(group);
  const courseIds = idsForCourse(group.courseCode, groupsByCode);
  const canonicalTimeGroups = group.timeGroups ?? [group];
  const conflicting = canonicalTimeGroups.some((timeGroup) => (
    conflictGroupKeys.has(timeGroup.key)
    && timeGroup.sectionIds.some((id) => selectedIds.has(id))
  ));
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
        group={group}
        groupSelected={groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id))}
        courseSelected={courseIds.length > 0 && courseIds.every((id) => selectedIds.has(id))}
        conflicting={conflicting}
        theme={themeMode}
        favoriteIds={favoriteIds}
        toggleFavorite={toggleFavorite}
        onToggleGroup={() => onToggleGroupRow(group)}
        onToggleCourse={() => onToggleCourseRow(group)}
        onOpenDetail={() => onOpenDetailRow(group.key)}
      />
    </div>
  );
}

const DEFAULT_ROW_HEIGHT = 150;
const ROW_GAP = 4;

export default function CoursePool({
  groups,
  selectedIds,
  conflictGroupKeys,
  themeMode,
  onOpenDetail,
  courseMap,
  groupsByCode,
}: Props) {
  const { activePlan, dispatch } = usePlans();
  const { timeGroupKeys, toggle: toggleFavorite } = useFavorites();
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

  const toggle = useCallback((group: CourseGroup, scope: 'group' | 'course') => {
    if (!activePlan) {
      message.warning('请先新建一个方案');
      return;
    }
    const ids = scope === 'group'
      ? idsForGroup(group)
      : idsForCourse(group.courseCode, groupsByCode);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      dispatch({ type: 'removeCourses', courseIds: ids });
      message.success(scope === 'group'
        ? `已移除「${group.courseName}」的此时间组`
        : `已移除「${group.courseName}」的全部时间组`);
      return;
    }
    const existing = activePlan.courseIds
      .map((cid) => courseMap.get(cid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const targetGroups = scope === 'group'
      ? [group]
      : groupsByCode.get(group.courseCode) ?? [];
    const conflictNames = conflictingCourseNamesForSelection(
      targetGroups,
      buildCourseGroups(existing),
    );
    if (conflictNames.length > 0) {
      const summary = conflictNames.slice(0, 3).join('、');
      const scopeLabel = scope === 'group' ? '此时间组' : '部分时间组';
      message.warning(`「${group.courseName}」的${scopeLabel}与已选课程存在时间冲突：${summary}（仍已选择）`);
    } else {
      message.success(scope === 'group'
        ? `已选择「${group.courseName}」的此时间组`
        : `已选择「${group.courseName}」的全部时间组`);
    }
    dispatch({ type: 'addCourses', courseIds: ids });
  }, [activePlan, courseMap, dispatch, groupsByCode, message, selectedIds]);

  const toggleGroup = useCallback(
    (group: CourseGroup) => toggle(group, 'group'),
    [toggle],
  );
  const toggleCourse = useCallback(
    (group: CourseGroup) => toggle(group, 'course'),
    [toggle],
  );

  const rowProps = useMemo<RowExtraProps>(() => ({
    groups,
    selectedIds,
    groupsByCode,
    conflictGroupKeys,
    themeMode,
    favoriteIds: timeGroupKeys,
    toggleFavorite,
    onToggleGroupRow: toggleGroup,
    onToggleCourseRow: toggleCourse,
    onOpenDetailRow: onOpenDetail,
    observeRowElements: rowHeight.observeRowElements,
  }), [groups, selectedIds, groupsByCode, conflictGroupKeys, themeMode, timeGroupKeys, toggleFavorite, toggleGroup, toggleCourse, onOpenDetail, rowHeight.observeRowElements]);

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
