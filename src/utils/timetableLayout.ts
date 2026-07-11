export interface TimetableRangeEntry {
  id: string;
  start: number;
  end: number;
  span: number;
}

export function assignTimetableLanes(entries: TimetableRangeEntry[]) {
  const sorted = [...entries].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id),
  );
  const laneEnds: number[] = [];
  const laneById = new Map<string, number>();

  for (const entry of sorted) {
    let lane = laneEnds.findIndex((end) => end < entry.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = entry.end;
    laneById.set(entry.id, lane);
  }

  return { laneById, laneCount: laneEnds.length };
}

export function getMobileContainmentLayers(
  entries: TimetableRangeEntry[],
  clusterStart: number,
  clusterSpan: number,
) {
  const rangeCounts = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.start}-${entry.end}`;
    rangeCounts.set(key, (rangeCounts.get(key) ?? 0) + 1);
  }
  const ranges = [...new Map(
    entries.map((entry) => [`${entry.start}-${entry.end}`, {
      id: `${entry.start}-${entry.end}`,
      start: entry.start,
      end: entry.end,
      span: entry.span,
    }]),
  ).values()];
  const rangeLanes = assignTimetableLanes(ranges).laneById;
  const depthMemo = new Map<string, number>();

  const getDepth = (start: number, end: number, span: number): number => {
    const key = `${start}-${end}`;
    const cached = depthMemo.get(key);
    if (cached !== undefined) return cached;
    const containers = ranges.filter((range) =>
      range.span > span && range.start <= start && range.end >= end,
    );
    const depth = containers.length === 0
      ? 0
      : 1 + Math.max(...containers.map((range) => getDepth(range.start, range.end, range.span)));
    depthMemo.set(key, depth);
    return depth;
  };

  return entries.map((entry) => {
    const rangeKey = `${entry.start}-${entry.end}`;
    const depth = getDepth(entry.start, entry.end, entry.span);
    const lane = rangeLanes.get(rangeKey) ?? 0;
    return {
      id: entry.id,
      depth,
      lane,
      rangeCount: rangeCounts.get(rangeKey) ?? 1,
      topPercent: ((entry.start - clusterStart) / clusterSpan) * 100,
      heightPercent: (entry.span / clusterSpan) * 100,
      leftInset: lane * 8,
      rightInset: lane * 8,
    };
  });
}

export function getMobileContainmentGroups(
  entries: TimetableRangeEntry[],
  clusterStart: number,
  clusterSpan: number,
) {
  const layers = getMobileContainmentLayers(entries, clusterStart, clusterSpan);
  const groups = new Map<string, {
    key: string;
    start: number;
    end: number;
    span: number;
    depth: number;
    lane: number;
    topPercent: number;
    heightPercent: number;
    leftInset: number;
    rightInset: number;
    entryIds: string[];
  }>();

  entries.forEach((entry, index) => {
    const key = `${entry.start}-${entry.end}`;
    const group = groups.get(key);
    if (group) {
      group.entryIds.push(entry.id);
      return;
    }
    const layer = layers[index];
    groups.set(key, {
      key,
      start: entry.start,
      end: entry.end,
      span: entry.span,
      depth: layer.depth,
      lane: layer.lane,
      topPercent: layer.topPercent,
      heightPercent: layer.heightPercent,
      leftInset: layer.leftInset,
      rightInset: layer.rightInset,
      entryIds: [entry.id],
    });
  });

  const result = [...groups.values()];
  return result.map((group) => ({
    ...group,
    rangeCount: group.entryIds.length,
  })).sort((a, b) => a.depth - b.depth || a.start - b.start || b.end - a.end);
}

export function getMobileContainmentMetrics(
  groups: ReturnType<typeof getMobileContainmentGroups>,
  clusterSpan: number,
  cardMinHeight = 96,
  cardGap = 6,
) {
  const groupHeights = new Map(groups.map((group) => [
    group.key,
    group.rangeCount * cardMinHeight
      + Math.max(0, group.rangeCount - 1) * cardGap,
  ]));
  const metrics = groups.map((group) => {
    const contentOffset = groups.reduce((offset, candidate) => (
      candidate.start === group.start
      && candidate.end > group.end
      && candidate.depth < group.depth
        ? offset + (groupHeights.get(candidate.key) ?? 0)
        : offset
    ), 0);
    return {
      key: group.key,
      contentOffset,
      contentHeight: groupHeights.get(group.key) ?? cardMinHeight,
    };
  });
  const minHeight = Math.ceil(metrics.reduce((requiredHeight, metric) => {
    const group = groups.find((candidate) => candidate.key === metric.key);
    if (!group) return requiredHeight;
    const spanRatio = group.span / clusterSpan;
    return Math.max(
      requiredHeight,
      (metric.contentOffset + metric.contentHeight) / spanRatio,
    );
  }, 0));
  return { minHeight, metrics };
}
