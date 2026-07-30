import { Button, Checkbox, Empty, Spin } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CourseGroup, CourseSection } from '@/types';
import {
  filterCourseGroupsByTime,
  type CourseTimeSearchMode,
} from '@/utils/courseTimeSearch';
import BottomModal from './BottomModal';
import CoursePool from './CoursePool';
import TimeSlotGrid, {
  type TimeSlotPaintChange,
} from './TimeSlotGrid';

interface Props {
  open: boolean;
  onClose: () => void;
  groups: CourseGroup[];
  selectedIds: Set<string>;
  conflictGroupKeys: Set<string>;
  themeMode: 'light' | 'dark';
  onOpenDetail: (groupKey: string) => void;
  courseMap: ReadonlyMap<string, CourseSection>;
  groupsByCode: ReadonlyMap<string, CourseGroup[]>;
}

const SEARCH_CHUNK_SIZE = 240;

function waitForPaint(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function yieldToBrowser(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export default function CourseFinderModal({
  open,
  onClose,
  groups,
  selectedIds,
  conflictGroupKeys,
  themeMode,
  onOpenDetail,
  courseMap,
  groupsByCode,
}: Props) {
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<CourseTimeSearchMode>('within');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultGroups, setResultGroups] = useState<CourseGroup[]>([]);
  const searchGenerationRef = useRef(0);

  const resultCourseCount = useMemo(
    () => new Set(resultGroups.map((group) => group.courseCode)).size,
    [resultGroups],
  );

  const invalidateResults = () => {
    searchGenerationRef.current += 1;
    setSearching(false);
    setHasSearched(false);
    setResultGroups([]);
  };

  useEffect(() => {
    searchGenerationRef.current += 1;
    setSearching(false);
    setHasSearched(false);
    setResultGroups([]);
  }, [groups]);

  useEffect(() => {
    if (open) return;
    searchGenerationRef.current += 1;
    setSearching(false);
  }, [open]);

  useEffect(() => () => {
    searchGenerationRef.current += 1;
  }, []);

  const paintSlots = (changes: readonly TimeSlotPaintChange[]) => {
    setSelectedSlots((current) => {
      const next = new Set(current);
      for (const { key, state } of changes) {
        if (state === 'blocked') next.add(key);
        else next.delete(key);
      }
      return next;
    });
    invalidateResults();
  };

  const clearSlots = () => {
    setSelectedSlots(new Set());
    invalidateResults();
  };

  const runSearch = async () => {
    if (searching || selectedSlots.size === 0) return;

    const generation = searchGenerationRef.current + 1;
    searchGenerationRef.current = generation;
    const selection = new Set(selectedSlots);
    const searchMode = mode;
    setSearching(true);

    // 先让出一次绘制，再分块扫描，数据量较大时加载动画仍能持续更新。
    await waitForPaint();
    const matches: CourseGroup[] = [];
    for (let index = 0; index < groups.length; index += SEARCH_CHUNK_SIZE) {
      if (searchGenerationRef.current !== generation) return;
      matches.push(...filterCourseGroupsByTime(
        groups.slice(index, index + SEARCH_CHUNK_SIZE),
        selection,
        searchMode,
      ));
      if (index + SEARCH_CHUNK_SIZE < groups.length) await yieldToBrowser();
    }

    if (searchGenerationRef.current !== generation) return;
    setResultGroups(matches);
    setHasSearched(true);
    setSearching(false);
  };

  const resultStatus = searching
    ? '正在寻找…'
    : hasSearched
      ? `${resultCourseCount} 门课程 · ${resultGroups.length} 个时间组`
      : '尚未寻找';

  return (
    <BottomModal
      open={open}
      title="寻找课程"
      onClose={onClose}
      width={1120}
      className="course-finder-modal"
      footer={(
        <p className="course-finder__disclaimer">
          实验性功能，请仔细核对搜索结果中课程信息，搜索结果也有可能展示不全。
        </p>
      )}
    >
      <div className="course-finder__layout">
        <section className="course-finder__picker-pane" aria-labelledby="course-finder-picker-title">
          <div className="availability-grid-section-header">
            <div className="availability-grid-section-copy">
              <h3 id="course-finder-picker-title">选择时间块</h3>
              <p>
                点击切换未选择与已选择；按住鼠标拖动可连续选择或取消。
                默认仅寻找全部上课节次均在所选范围内的课程时间组。
              </p>
            </div>
            <Button
              className="availability-grid-clear-button"
              disabled={selectedSlots.size === 0}
              onClick={clearSlots}
            >
              清空
            </Button>
          </div>

          <TimeSlotGrid
            ariaLabel="寻找课程时间选择"
            getState={(key) => selectedSlots.has(key) ? 'blocked' : 'empty'}
            nextState={(state) => state === 'empty' ? 'blocked' : 'empty'}
            onPaint={paintSlots}
            stateLabels={{
              empty: '未选择',
              blocked: '已选择',
              hard: '强冲突',
            }}
          />

          <div className="course-finder__criteria">
            <Checkbox
              checked={mode === 'within'}
              onChange={(event) => {
                setMode(event.target.checked ? 'within' : 'contains');
                invalidateResults();
              }}
            >
              只在这些时间块中
            </Checkbox>
            <span className="course-finder__selection-count">
              已选 {selectedSlots.size} 个时间块
            </span>
            <Button
              type="primary"
              loading={searching}
              disabled={selectedSlots.size === 0}
              onClick={() => void runSearch()}
            >
              寻找
            </Button>
          </div>
          <p className="course-finder__mode-help">
            {mode === 'within'
              ? '仅返回全部上课节次均落在所选范围内的时间组。'
              : '课程只要有上课节次落在所选范围内即可，也可以包含其他上课时间。'}
          </p>
        </section>

        <section className="course-finder__results-pane" aria-labelledby="course-finder-results-title">
          <div className="course-finder__results-header">
            <h3 id="course-finder-results-title">搜索结果</h3>
            <span aria-live="polite">{resultStatus}</span>
          </div>
          <div className="course-finder__results-content" aria-busy={searching}>
            {searching ? (
              <div className="course-finder__loading" role="status">
                <Spin size="large" />
                <span>正在寻找匹配课程…</span>
              </div>
            ) : hasSearched ? (
              <CoursePool
                groups={resultGroups}
                selectedIds={selectedIds}
                conflictGroupKeys={conflictGroupKeys}
                themeMode={themeMode}
                onOpenDetail={onOpenDetail}
                courseMap={courseMap}
                groupsByCode={groupsByCode}
                className="course-finder__course-pool"
                dataTour={null}
                emptyDescription="没有符合所选时间条件的课程"
              />
            ) : (
              <div className="course-finder__empty">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="勾选时间块后点击“寻找”"
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </BottomModal>
  );
}
