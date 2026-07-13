import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CourseDetail } from '@/types';
import CourseDescriptionPanel from './CourseDescriptionPanel';

function makeDetail(description: CourseDetail['description']): CourseDetail {
  return {
    code: '001108.01',
    name: { cn: '数学实验', en: 'Mathematical Experiments' },
    dept: '数学科学学院',
    credit: 2,
    hour: 40,
    sem: '2026年秋季学期',
    grading: '百分制',
    examType: '考试',
    discipline: '数学',
    lang: '中文',
    prerequisite: '',
    legacyTextbook: '',
    textbooks: [],
    materials: [],
    referenceBooks: '',
    description,
    syllabus: '',
  };
}

function renderPanel(detail: CourseDetail | undefined, open: boolean): string {
  return renderToStaticMarkup(createElement(CourseDescriptionPanel, {
    detail,
    open,
    onOpenChange: vi.fn(),
  }));
}

describe('CourseDescriptionPanel', () => {
  it('offers the description action while collapsed', () => {
    const html = renderPanel(makeDetail({ cn: '中文简介', en: 'English description' }), false);
    expect(html).toContain('查看课程简介');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('English description');
  });

  it('shows every available scraped description without another request', () => {
    const html = renderPanel(makeDetail({ cn: ' 中文简介 ', en: ' English description ' }), true);
    expect(html).toContain('中文简介');
    expect(html).toContain('English description');
    expect(html).toContain('aria-expanded="true"');
  });

  it('renders scraped HTML descriptions as safe readable text', () => {
    const html = renderPanel(makeDetail({
      cn: '<p>中文课程简介</p>',
      en: '<p>&ldquo;Ordinary Differential Equations&rdquo;</p>',
    }), true);

    expect(html).toContain('中文课程简介');
    expect(html).toContain('“Ordinary Differential Equations”');
    expect(html).not.toContain('&lt;p&gt;');
  });

  it('shows a clear empty state when neither description exists', () => {
    const html = renderPanel(makeDetail({ cn: ' ', en: '' }), true);
    expect(html).toContain('暂无课程简介');
  });
});
