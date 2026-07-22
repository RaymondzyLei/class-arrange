import { expandWeeks } from './weeks';

export interface ScheduleDisplaySource {
  weeks: number[];
  day: number;
  periods: number[];
  startTime?: string;
  endTime?: string;
  room?: string;
  campus?: string;
}

export interface DisplayScheduleSlot extends Omit<ScheduleDisplaySource, 'weeks'> {
  /** 完整、排序且去重的实际开课周；不使用二元素闭区间编码。 */
  activeWeeks: number[];
  /** 区分“周次未指定”与已明确但为空的防御性结果。 */
  weeksSpecified: boolean;
}

interface MutableDisplayScheduleSlot extends DisplayScheduleSlot {
  activeWeekSet: Set<number>;
  signature: string;
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values.filter(Number.isInteger))].sort((a, b) => a - b);
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function normalizedSlot(slot: ScheduleDisplaySource) {
  return {
    day: slot.day,
    periods: uniqueSorted(slot.periods),
    startTime: cleanOptional(slot.startTime),
    endTime: cleanOptional(slot.endTime),
    room: cleanOptional(slot.room),
    campus: cleanOptional(slot.campus),
  };
}

function displaySignature(
  slot: ReturnType<typeof normalizedSlot>,
  weeksSpecified: boolean,
): string {
  return JSON.stringify([
    weeksSpecified,
    slot.day,
    slot.periods,
    slot.startTime ?? '',
    slot.endTime ?? '',
    slot.room ?? '',
    slot.campus ?? '',
  ]);
}

function firstActiveWeek(slot: DisplayScheduleSlot): number {
  return slot.activeWeeks[0] ?? 999;
}

function compareDisplaySlots(a: DisplayScheduleSlot, b: DisplayScheduleSlot): number {
  return firstActiveWeek(a) - firstActiveWeek(b)
    || (a.room ?? '').localeCompare(b.room ?? '', 'zh-Hans-CN')
    || (a.campus ?? '').localeCompare(b.campus ?? '', 'zh-Hans-CN')
    || a.day - b.day
    || (a.periods[0] ?? 999) - (b.periods[0] ?? 999)
    || (a.startTime ?? '').localeCompare(b.startTime ?? '')
    || (a.endTime ?? '').localeCompare(b.endTime ?? '');
}

/**
 * 将相同星期、时间和地点的来源片段合成一个显示项。
 * 周次始终保存为完整集合，因此非连续的两周不会被误读成闭区间。
 */
export function coalesceScheduleSlots(
  schedule: readonly ScheduleDisplaySource[],
): DisplayScheduleSlot[] {
  const grouped = new Map<string, MutableDisplayScheduleSlot>();

  for (const source of schedule) {
    const normalized = normalizedSlot(source);
    const weeksSpecified = source.weeks.length > 0;
    const signature = displaySignature(normalized, weeksSpecified);
    let display = grouped.get(signature);
    if (!display) {
      display = {
        ...normalized,
        activeWeeks: [],
        weeksSpecified,
        activeWeekSet: new Set<number>(),
        signature,
      };
      grouped.set(signature, display);
    }

    for (const week of expandWeeks(source.weeks)) {
      if (Number.isInteger(week)) display.activeWeekSet.add(week);
    }
  }

  return [...grouped.values()]
    .map(({ activeWeekSet, signature: _signature, ...slot }) => ({
      ...slot,
      activeWeeks: [...activeWeekSet].sort((a, b) => a - b),
    }))
    .sort(compareDisplaySlots);
}

/** 将完整周集合压缩为“2~3周、18周”一类不会掩盖空档的文本。 */
export function formatActiveWeeks(weeks: readonly number[]): string {
  const sorted = uniqueSorted(weeks);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `${sorted[0]}周`;

  if (
    sorted.length >= 3
    && sorted.every((week, index) => index === 0 || week - sorted[index - 1] === 2)
  ) {
    const parity = sorted[0] % 2 === 1 ? '单' : '双';
    return `${sorted[0]}~${sorted.at(-1)}周(${parity})`;
  }

  const runs: number[][] = [];
  for (const week of sorted) {
    const current = runs.at(-1);
    if (!current || week !== current.at(-1)! + 1) runs.push([week]);
    else current.push(week);
  }

  return runs
    .map((run) => run.length === 1 ? `${run[0]}周` : `${run[0]}~${run.at(-1)}周`)
    .join('、');
}
