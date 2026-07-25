export type MemoMarkdownFormat =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'unordered-list'
  | 'ordered-list'
  | 'task-list'
  | 'blockquote'
  | 'inline-code'
  | 'link';

export const MEMO_MARKDOWN_FORMATS = [
  'heading',
  'bold',
  'italic',
  'strikethrough',
  'unordered-list',
  'ordered-list',
  'task-list',
  'blockquote',
  'inline-code',
  'link',
] as const satisfies readonly MemoMarkdownFormat[];

export interface MemoMarkdownEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

interface InlineFormat {
  before: string;
  after: string;
  placeholder: string;
}

interface FormatBounds {
  outerStart: number;
  outerEnd: number;
  innerStart: number;
  innerEnd: number;
}

interface TextReplacement {
  start: number;
  end: number;
  text: string;
}

type LineMarkdownFormat =
  | 'heading'
  | 'unordered-list'
  | 'ordered-list'
  | 'task-list'
  | 'blockquote';

const INLINE_FORMATS: Partial<Record<MemoMarkdownFormat, InlineFormat>> = {
  bold: { before: '**', after: '**', placeholder: '加粗文字' },
  italic: { before: '*', after: '*', placeholder: '斜体文字' },
  strikethrough: { before: '~~', after: '~~', placeholder: '删除线文字' },
  'inline-code': { before: '`', after: '`', placeholder: '代码' },
};

const LINE_PREFIX_PATTERNS: Record<LineMarkdownFormat, RegExp> = {
  heading: /^#{1,6}\s+/,
  'unordered-list': /^-\s+(?!\[[ xX]\]\s+)/,
  'ordered-list': /^\d+\.\s+/,
  'task-list': /^-\s+\[[ xX]\]\s+/,
  blockquote: /^>\s+/,
};

function clamp(value: number, maximum: number): number {
  return Math.max(0, Math.min(Math.trunc(value), maximum));
}

function normalizeSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): [number, number] {
  const start = clamp(selectionStart, text.length);
  const end = clamp(selectionEnd, text.length);
  return start <= end ? [start, end] : [end, start];
}

function applyInlineFormat(
  text: string,
  start: number,
  end: number,
  format: InlineFormat,
): MemoMarkdownEdit {
  const bounds = inlineFormatBounds(text, start, end, format);
  if (bounds) {
    const content = text.slice(bounds.innerStart, bounds.innerEnd);
    return {
      text: `${text.slice(0, bounds.outerStart)}${content}${text.slice(bounds.outerEnd)}`,
      selectionStart: bounds.outerStart,
      selectionEnd: bounds.outerStart + content.length,
    };
  }

  const selected = text.slice(start, end);
  const content = selected || format.placeholder;
  return {
    text: `${text.slice(0, start)}${format.before}${content}${format.after}${text.slice(end)}`,
    selectionStart: start + format.before.length,
    selectionEnd: start + format.before.length + content.length,
  };
}

function inlineFormatBounds(
  text: string,
  start: number,
  end: number,
  format: InlineFormat,
): FormatBounds | null {
  const selected = text.slice(start, end);
  if (
    selected.length >= format.before.length + format.after.length
    && selected.startsWith(format.before)
    && selected.endsWith(format.after)
  ) {
    return {
      outerStart: start,
      outerEnd: end,
      innerStart: start + format.before.length,
      innerEnd: end - format.after.length,
    };
  }

  const outerStart = start - format.before.length;
  const outerEnd = end + format.after.length;
  if (
    outerStart < 0
    || text.slice(outerStart, start) !== format.before
    || text.slice(end, outerEnd) !== format.after
  ) {
    return null;
  }

  // A bold marker contains a single "*" on both sides as well. Do not report
  // the inner selection of **text** as italic.
  if (
    format.before === '*'
    && (
      text.slice(start - 2, start) === '**'
      || text.slice(end, end + 2) === '**'
    )
  ) {
    return null;
  }

  return {
    outerStart,
    outerEnd,
    innerStart: start,
    innerEnd: end,
  };
}

function lineBounds(text: string, start: number, end: number): [number, number] {
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextLineBreak = text.indexOf('\n', end);
  return [lineStart, nextLineBreak === -1 ? text.length : nextLineBreak];
}

function isLineFormat(format: MemoMarkdownFormat): format is LineMarkdownFormat {
  return Object.prototype.hasOwnProperty.call(LINE_PREFIX_PATTERNS, format);
}

function lineFormatActive(
  text: string,
  start: number,
  end: number,
  format: LineMarkdownFormat,
): boolean {
  const [blockStart, blockEnd] = lineBounds(text, start, end);
  const nonEmptyLines = text.slice(blockStart, blockEnd).split('\n').filter(Boolean);
  return (
    nonEmptyLines.length > 0
    && nonEmptyLines.every((line) => LINE_PREFIX_PATTERNS[format].test(line))
  );
}

function linePrefix(
  format: MemoMarkdownFormat,
  index: number,
): { prefix: string; placeholder: string } {
  switch (format) {
    case 'heading':
      return { prefix: '## ', placeholder: '标题' };
    case 'unordered-list':
      return { prefix: '- ', placeholder: '列表项' };
    case 'ordered-list':
      return { prefix: `${index + 1}. `, placeholder: '列表项' };
    case 'task-list':
      return { prefix: '- [ ] ', placeholder: '待办事项' };
    case 'blockquote':
      return { prefix: '> ', placeholder: '引用内容' };
    default:
      throw new Error(`Unsupported line format: ${format}`);
  }
}

function mapPositionThroughReplacements(
  position: number,
  replacements: readonly TextReplacement[],
): number {
  let delta = 0;

  for (const replacement of replacements) {
    if (position <= replacement.start) break;
    if (position < replacement.end) {
      return replacement.start
        + delta
        + Math.min(position - replacement.start, replacement.text.length);
    }
    delta += replacement.text.length - (replacement.end - replacement.start);
  }

  return position + delta;
}

export function normalizeMemoOrderedLists(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): MemoMarkdownEdit {
  const [start, end] = normalizeSelection(text, selectionStart, selectionEnd);
  const replacements: TextReplacement[] = [];
  let expectedNumber: number | null = null;
  let lineStart = 0;

  for (const line of text.split('\n')) {
    const marker = line.match(/^(\d+)(?=\.\s+)/);
    if (!marker) {
      expectedNumber = null;
    } else {
      const currentNumber = Number(marker[1]);
      if (!Number.isSafeInteger(currentNumber)) {
        expectedNumber = null;
      } else {
        if (expectedNumber === null) expectedNumber = currentNumber;
        const nextMarker = String(expectedNumber);
        if (nextMarker !== marker[1]) {
          replacements.push({
            start: lineStart,
            end: lineStart + marker[1].length,
            text: nextMarker,
          });
        }
        expectedNumber = Number.isSafeInteger(expectedNumber + 1)
          ? expectedNumber + 1
          : null;
      }
    }
    lineStart += line.length + 1;
  }

  if (replacements.length === 0) {
    return { text, selectionStart: start, selectionEnd: end };
  }

  let normalizedText = '';
  let sourcePosition = 0;
  for (const replacement of replacements) {
    normalizedText += text.slice(sourcePosition, replacement.start);
    normalizedText += replacement.text;
    sourcePosition = replacement.end;
  }
  normalizedText += text.slice(sourcePosition);

  return {
    text: normalizedText,
    selectionStart: mapPositionThroughReplacements(start, replacements),
    selectionEnd: mapPositionThroughReplacements(end, replacements),
  };
}

export function continueMemoOrderedList(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): MemoMarkdownEdit | null {
  const [start, end] = normalizeSelection(text, selectionStart, selectionEnd);
  if (start !== end) return null;

  const [currentLineStart, currentLineEnd] = lineBounds(text, start, end);
  const currentLine = text.slice(currentLineStart, currentLineEnd);
  const marker = currentLine.match(/^(\d+)\.\s+/);
  if (!marker || start < currentLineStart + marker[0].length) return null;

  const currentNumber = Number(marker[1]);
  if (!Number.isSafeInteger(currentNumber) || !Number.isSafeInteger(currentNumber + 1)) {
    return null;
  }

  if (!currentLine.slice(marker[0].length).trim()) {
    const withoutEmptyItem = `${text.slice(0, currentLineStart)}${text.slice(currentLineEnd)}`;
    return normalizeMemoOrderedLists(
      withoutEmptyItem,
      currentLineStart,
      currentLineStart,
    );
  }

  const nextPrefix = `\n${currentNumber + 1}. `;
  const continuedText = `${text.slice(0, start)}${nextPrefix}${text.slice(end)}`;
  const nextPosition = start + nextPrefix.length;
  return normalizeMemoOrderedLists(continuedText, nextPosition, nextPosition);
}

function applyLineFormat(
  text: string,
  start: number,
  end: number,
  format: LineMarkdownFormat,
): MemoMarkdownEdit {
  const [blockStart, blockEnd] = lineBounds(text, start, end);
  const block = text.slice(blockStart, blockEnd);

  if (!block) {
    const { prefix, placeholder } = linePrefix(format, 0);
    return {
      text: `${text.slice(0, blockStart)}${prefix}${placeholder}${text.slice(blockEnd)}`,
      selectionStart: blockStart + prefix.length,
      selectionEnd: blockStart + prefix.length + placeholder.length,
    };
  }

  if (lineFormatActive(text, start, end, format)) {
    const unformatted = block
      .split('\n')
      .map((line) => line.replace(LINE_PREFIX_PATTERNS[format], ''))
      .join('\n');
    return {
      text: `${text.slice(0, blockStart)}${unformatted}${text.slice(blockEnd)}`,
      selectionStart: blockStart,
      selectionEnd: blockStart + unformatted.length,
    };
  }

  let formattedLineIndex = 0;
  const formatted = block
    .split('\n')
    .map((line) => {
      if (!line) return line;
      const { prefix } = linePrefix(format, formattedLineIndex);
      formattedLineIndex += 1;
      return `${prefix}${line}`;
    })
    .join('\n');

  return {
    text: `${text.slice(0, blockStart)}${formatted}${text.slice(blockEnd)}`,
    selectionStart: blockStart,
    selectionEnd: blockStart + formatted.length,
  };
}

function linkFormatBounds(
  text: string,
  start: number,
  end: number,
): FormatBounds | null {
  const selected = text.slice(start, end);
  const fullLink = selected.match(/^\[([^\]\n]+)\]\(([^)\n]*)\)$/);
  if (fullLink) {
    return {
      outerStart: start,
      outerEnd: end,
      innerStart: start + 1,
      innerEnd: start + 1 + fullLink[1].length,
    };
  }

  const beforeUrl = text.slice(0, start).match(/\[([^\]\n]+)\]\($/);
  if (beforeUrl && text[end] === ')') {
    const outerStart = start - beforeUrl[0].length;
    return {
      outerStart,
      outerEnd: end + 1,
      innerStart: outerStart + 1,
      innerEnd: outerStart + 1 + beforeUrl[1].length,
    };
  }

  if (text[start - 1] === '[') {
    const afterLabel = text.slice(end).match(/^\]\(([^)\n]*)\)/);
    if (afterLabel) {
      return {
        outerStart: start - 1,
        outerEnd: end + afterLabel[0].length,
        innerStart: start,
        innerEnd: end,
      };
    }
  }

  return null;
}

export function applyMemoMarkdownFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: MemoMarkdownFormat,
): MemoMarkdownEdit {
  const [start, end] = normalizeSelection(text, selectionStart, selectionEnd);
  const inlineFormat = INLINE_FORMATS[format];
  if (inlineFormat) return applyInlineFormat(text, start, end, inlineFormat);

  if (format === 'link') {
    const bounds = linkFormatBounds(text, start, end);
    if (bounds) {
      const label = text.slice(bounds.innerStart, bounds.innerEnd);
      return {
        text: `${text.slice(0, bounds.outerStart)}${label}${text.slice(bounds.outerEnd)}`,
        selectionStart: bounds.outerStart,
        selectionEnd: bounds.outerStart + label.length,
      };
    }

    const label = text.slice(start, end) || '链接文字';
    const url = 'https://';
    return {
      text: `${text.slice(0, start)}[${label}](${url})${text.slice(end)}`,
      selectionStart: start + label.length + 3,
      selectionEnd: start + label.length + 3 + url.length,
    };
  }

  if (!isLineFormat(format)) return { text, selectionStart: start, selectionEnd: end };
  const edit = applyLineFormat(text, start, end, format);
  return format === 'ordered-list'
    ? normalizeMemoOrderedLists(edit.text, edit.selectionStart, edit.selectionEnd)
    : edit;
}

export function isMemoMarkdownFormatActive(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: MemoMarkdownFormat,
): boolean {
  const [start, end] = normalizeSelection(text, selectionStart, selectionEnd);
  const inlineFormat = INLINE_FORMATS[format];
  if (inlineFormat) return inlineFormatBounds(text, start, end, inlineFormat) !== null;
  if (format === 'link') return linkFormatBounds(text, start, end) !== null;
  return isLineFormat(format) && lineFormatActive(text, start, end, format);
}
