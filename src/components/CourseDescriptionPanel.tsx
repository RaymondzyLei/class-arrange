import { useId } from 'react';
import { Button, Empty, Typography } from 'antd';
import type { CourseDetail } from '@/types';

interface Props {
  detail?: CourseDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return HTML_ENTITIES[entity.toLowerCase()] ?? match;
    const hexadecimal = entity[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    return String.fromCodePoint(codePoint);
  });
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

export default function CourseDescriptionPanel({ detail, open, onOpenChange }: Props) {
  const panelId = useId();
  const chineseDescription = readableDescription(detail?.description.cn);
  const englishDescription = readableDescription(detail?.description.en);
  const hasDescription = Boolean(chineseDescription || englishDescription);

  return (
    <section className="course-description-disclosure">
      <Button
        size="small"
        type="default"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        查看课程简介
      </Button>
      {open ? (
        <div
          id={panelId}
          className="course-description-panel"
          role="region"
          aria-label="课程简介"
        >
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
      ) : null}
    </section>
  );
}
