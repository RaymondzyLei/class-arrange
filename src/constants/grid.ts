export const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
export const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export const DAY_LABELS: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
};
