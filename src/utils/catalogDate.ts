export function formatCatalogUpdatedDate(generatedAt: string): string {
  const value = generatedAt.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return `${Number(dateOnly[1])}.${Number(dateOnly[2])}.${Number(dateOnly[3])}`;
  }

  const timestamp = new Date(value);
  if (!Number.isNaN(timestamp.getTime())) {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(timestamp);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((candidate) => candidate.type === type)?.value;
    const year = part('year');
    const month = part('month');
    const day = part('day');
    if (year && month && day) return `${Number(year)}.${Number(month)}.${Number(day)}`;
  }

  const prefix = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!prefix) return generatedAt;
  return `${Number(prefix[1])}.${Number(prefix[2])}.${Number(prefix[3])}`;
}
