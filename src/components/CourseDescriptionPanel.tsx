import { Button, Empty, Typography } from 'antd';
import type { CourseDetail } from '@/types';
import { ChevronIcon } from './icons';

interface Props {
  detail?: CourseDetail;
  panelId: string;
  open: boolean;
}

interface ToggleProps {
  panelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FALLBACK_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  eacute: 'é',
  egrave: 'è',
  emsp: '\u2003',
  gt: '>',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

function decodeHtmlEntitiesFallback(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return FALLBACK_HTML_ENTITIES[entity.toLowerCase()] ?? match;
    const hexadecimal = entity[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    return String.fromCodePoint(codePoint);
  });
}

function decodeHtmlEntities(value: string): string {
  if (typeof document === 'undefined') return decodeHtmlEntitiesFallback(value);
  const decoder = document.createElement('textarea');
  decoder.innerHTML = value;
  return decoder.value;
}

function readableDescription(value: string | undefined): string {
  if (!value) return '';
  const withoutMarkup = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|h[1-6]|li|p|section)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
  return decodeHtmlEntities(withoutMarkup)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function CourseDescriptionToggle({ panelId, open, onOpenChange }: ToggleProps) {
  return (
    <Button
      size="small"
      type="text"
      className="course-description-toggle"
      aria-controls={panelId}
      aria-expanded={open}
      icon={(
        <ChevronIcon
          className={`select-chevron${open ? ' select-chevron--open' : ''}`}
        />
      )}
      iconPosition="end"
      onClick={() => onOpenChange(!open)}
    >
      查看课程简介
    </Button>
  );
}

export default function CourseDescriptionPanel({ detail, panelId, open }: Props) {
  const chineseDescription = readableDescription(detail?.description.cn);
  const englishDescription = readableDescription(detail?.description.en);
  const hasDescription = Boolean(chineseDescription || englishDescription);

  return (
    <section
      id={panelId}
      className={`course-description-region${open ? ' course-description-region--open' : ''}`}
      role="region"
      aria-label="课程简介"
      aria-hidden={!open}
    >
      <div className="course-description-region__clip">
        <div className="course-description-panel">
          {chineseDescription ? (
            <div className="course-description-panel__section">
              <Typography.Text strong>中文简介</Typography.Text>
              <Typography.Paragraph>{chineseDescription}</Typography.Paragraph>
            </div>
          ) : null}
          {englishDescription ? (
            <div className="course-description-panel__section">
              <Typography.Text strong>英文简介</Typography.Text>
              <Typography.Paragraph>{englishDescription}</Typography.Paragraph>
            </div>
          ) : null}
          {!hasDescription ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无课程简介" />
          ) : null}
        </div>
      </div>
    </section>
  );
}
