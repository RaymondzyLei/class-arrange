import type { CourseDetail, CourseTextbook } from '@/types';

const EMPTY_VALUE = '—';

export interface CourseMaterialDisplay {
  textbooks: string;
  materials: string;
  referenceBooks: string;
}

function text(value: string): string {
  return value.trim();
}

function labeledText(label: string, value: string): string {
  const normalized = text(value);
  return normalized ? `${label}：${normalized}` : '';
}

/** 将一条结构化教材记录压缩成适合详情页自动换行的文本。 */
export function formatCourseTextbook(item: CourseTextbook): string {
  const parts = [
    text(item.nameZh),
    labeledText('版次', item.edition),
    labeledText('作者', item.author),
    labeledText('出版社', item.publishingHouse),
    labeledText('日期', item.dates),
    labeledText('ISBN', item.isbn),
  ].filter((part): part is string => Boolean(part));

  return parts.join('；') || EMPTY_VALUE;
}

function formatEntries(entries: CourseTextbook[]): string {
  if (entries.length === 0) return EMPTY_VALUE;
  return entries.map(formatCourseTextbook).join('；');
}

/**
 * 教材与讲义保持独立。只要存在任一结构化条目，就不再混入旧版教材文本。
 */
export function formatCourseMaterialDisplay(
  detail: CourseDetail | undefined,
): CourseMaterialDisplay {
  if (!detail) {
    return {
      textbooks: EMPTY_VALUE,
      materials: EMPTY_VALUE,
      referenceBooks: EMPTY_VALUE,
    };
  }

  const hasStructuredEntries = detail.textbooks.length > 0 || detail.materials.length > 0;
  const legacyTextbook = text(detail.legacyTextbook);

  return {
    textbooks: hasStructuredEntries
      ? formatEntries(detail.textbooks)
      : legacyTextbook || EMPTY_VALUE,
    materials: formatEntries(detail.materials),
    referenceBooks: text(detail.referenceBooks) || EMPTY_VALUE,
  };
}
