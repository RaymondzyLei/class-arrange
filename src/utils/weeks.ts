/**
 * 判断某 week 是否落在 weeks 数组所表示的周次集合内。
 * 编码约定：
 *   length === 2 → 闭区间 [start, end]，含所有整数周
 *   length > 2  → 显式枚举
 *   length === 1 → 单点（防御性处理）
 */
export function isWeekInArray(weeks: number[], week: number): boolean {
  if (weeks.length === 0) return false;
  if (weeks.length === 1) return weeks[0] === week;
  if (weeks.length === 2) return week >= weeks[0] && week <= weeks[1];
  return weeks.includes(week);
}

/** 展开为完整周次列表 */
export function expandWeeks(weeks: number[]): number[] {
  if (weeks.length === 0) return [];
  if (weeks.length > 2) return weeks.slice();
  const [a, b = a] = weeks;
  const out: number[] = [];
  for (let w = a; w <= b; w++) out.push(w);
  return out;
}

/** 把周次数组格式化为人类可读字符串：
 *  - length===2 闭区间 → "1~9周"；相同端点 → "1周"
 *  - length>2 枚举，若为连续等差(步长1/2) → "2~18周" / "1~17周(单)" / "2~18周(双)"
 *  - 否则 → "1,3,5周"
 */
export function formatWeeks(weeks: number[]): string {
  if (weeks.length === 0) return '';
  if (weeks.length === 1) return `${weeks[0]}周`;
  if (weeks.length === 2 && weeks[0] === weeks[1]) return `${weeks[0]}周`;
  if (weeks.length === 2) return `${weeks[0]}~${weeks[1]}周`;
  const sorted = [...weeks].sort((a, b) => a - b);
  const step = sorted[1] - sorted[0];
  const isArithmetic = step > 0 && sorted.every((w, i) => i === 0 || w - sorted[i - 1] === step);
  if (isArithmetic) {
    const range = `${sorted[0]}~${sorted[sorted.length - 1]}周`;
    if (step === 2) return sorted[0] % 2 === 1 ? `${range}(单)` : `${range}(双)`;
    return range;
  }
  return `${sorted.join(',')}周`;
}
