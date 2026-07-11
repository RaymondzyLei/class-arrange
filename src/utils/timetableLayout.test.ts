import { describe, expect, it } from 'vitest';
import {
  assignTimetableLanes,
  getMobileContainmentGroups,
  getMobileContainmentMetrics,
  getMobileContainmentLayers,
  type TimetableRangeEntry,
} from './timetableLayout';

const entry = (id: string, start: number, end: number): TimetableRangeEntry => ({
  id,
  start,
  end,
  span: end - start + 1,
});

describe('mobile timetable conflict containment', () => {
  it('places a shorter background inside a longer background', () => {
    const entries = [entry('long', 6, 9), entry('short', 6, 7)];
    expect(getMobileContainmentLayers(entries, 6, 4)).toEqual([
      { id: 'long', depth: 0, lane: 0, rangeCount: 1, topPercent: 0, heightPercent: 100, leftInset: 0, rightInset: 0 },
      { id: 'short', depth: 1, lane: 1, rangeCount: 1, topPercent: 0, heightPercent: 50, leftInset: 8, rightInset: 4 },
    ]);
  });

  it('keeps two shorter backgrounds visible inside one longer background', () => {
    const entries = [entry('long', 6, 9), entry('short-a', 6, 7), entry('short-b', 6, 7)];
    const layers = getMobileContainmentLayers(entries, 6, 4);
    expect(layers.map(({ heightPercent }) => heightPercent)).toEqual([100, 50, 50]);
    expect(layers.map(({ leftInset }) => leftInset)).toEqual([0, 8, 8]);
  });

  it('keeps two longer backgrounds visible around one shorter background', () => {
    const entries = [entry('long-a', 6, 9), entry('long-b', 6, 9), entry('short', 6, 7)];
    const layers = getMobileContainmentLayers(entries, 6, 4);
    expect(layers.map(({ heightPercent }) => heightPercent)).toEqual([100, 100, 50]);
    expect(layers.map(({ rightInset }) => rightInset)).toEqual([0, 0, 4]);
  });

  it('keeps identical time ranges in one visual level', () => {
    const entries = [entry('a', 3, 4), entry('b', 3, 4), entry('c', 3, 4)];
    const layers = getMobileContainmentLayers(entries, 3, 2);
    expect(layers.map(({ depth }) => depth)).toEqual([0, 0, 0]);
  });

  it('groups identical time ranges as siblings', () => {
    const entries = [
      entry('long-a', 6, 9),
      entry('long-b', 6, 9),
      entry('short-a', 6, 7),
      entry('short-b', 6, 7),
    ];
    const groups = getMobileContainmentGroups(entries, 6, 4);
    expect(groups.map(({ key, rangeCount }) => ({ key, rangeCount }))).toEqual([
      { key: '6-9', rangeCount: 2 },
      { key: '6-7', rangeCount: 2 },
    ]);
  });

  it('keeps same-range siblings independent inside a longer course', () => {
    const entries = [
      entry('long', 3, 5),
      entry('short-a', 3, 4),
      entry('short-b', 3, 4),
    ];
    const layers = getMobileContainmentLayers(entries, 3, 3);

    expect(layers.map(({ id, depth, rangeCount }) => ({ id, depth, rangeCount }))).toEqual([
      { id: 'long', depth: 0, rangeCount: 1 },
      { id: 'short-a', depth: 1, rangeCount: 2 },
      { id: 'short-b', depth: 1, rangeCount: 2 },
    ]);
    expect(getMobileContainmentGroups(entries, 3, 3).map((group) => ({
      key: group.key,
      rangeCount: group.rangeCount,
    }))).toEqual([
      { key: '3-5', rangeCount: 1 },
      { key: '3-4', rangeCount: 2 },
    ]);
  });

  it('reuses a lane when shorter courses do not overlap', () => {
    const entries = [entry('long', 6, 9), entry('early', 6, 7), entry('late', 8, 9)];
    const layout = assignTimetableLanes(entries);
    expect(layout.laneCount).toBe(2);
    expect(layout.laneById.get('early')).toBe(layout.laneById.get('late'));
    expect(getMobileContainmentLayers(entries, 6, 4).map(({ topPercent }) => topPercent))
      .toEqual([0, 0, 50]);
  });

  it('offsets partially overlapping ranges into adjacent mobile tracks', () => {
    const entries = [entry('blue', 6, 9), entry('orange', 8, 10)];
    const layers = getMobileContainmentLayers(entries, 6, 5);

    expect(layers.map(({ id, depth, lane, leftInset, topPercent, heightPercent }) => ({
      id,
      depth,
      lane,
      leftInset,
      topPercent,
      heightPercent,
    }))).toEqual([
      { id: 'blue', depth: 0, lane: 0, leftInset: 0, topPercent: 0, heightPercent: 80 },
      { id: 'orange', depth: 0, lane: 1, leftInset: 8, topPercent: 40, heightPercent: 60 },
    ]);
  });

  it('expands the mobile cell instead of compressing sibling cards', () => {
    const entries = [
      entry('long-a', 6, 9),
      entry('long-b', 6, 9),
      entry('short-a', 6, 7),
      entry('short-b', 6, 7),
    ];
    const groups = getMobileContainmentGroups(entries, 6, 4);

    expect(getMobileContainmentMetrics(groups, 4)).toEqual({
      minHeight: 792,
      metrics: [
        { key: '6-9', contentOffset: 0, contentHeight: 198 },
        { key: '6-7', contentOffset: 198, contentHeight: 198 },
      ],
    });
  });
});
