/**
 * Projects chronological update feeds for display without changing their
 * oldest-to-newest domain order. Later source entries win exact ties.
 */
export function newestFirstByDate<T>(
  items: readonly T[],
  getDate: (item: T) => string,
): T[] {
  return items
    .map((item, index) => ({ item, index, date: getDate(item) }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.date);
      const rightTime = Date.parse(right.date);
      const leftValid = !Number.isNaN(leftTime);
      const rightValid = !Number.isNaN(rightTime);

      if (leftValid && rightValid && leftTime !== rightTime) return rightTime - leftTime;
      if (leftValid !== rightValid) return leftValid ? -1 : 1;

      return right.date.localeCompare(left.date) || right.index - left.index;
    })
    .map(({ item }) => item);
}
