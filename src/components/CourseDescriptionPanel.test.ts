import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CourseDetail } from '@/types';
import CourseDescriptionPanel from './CourseDescriptionPanel';

const panelSource = readFileSync(new URL('./CourseDescriptionPanel.tsx', import.meta.url), 'utf8');
const detailModalSource = readFileSync(new URL('./CourseDetailModal.tsx', import.meta.url), 'utf8');
const bottomModalSource = readFileSync(new URL('./BottomModal.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

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
    panelId: 'description-panel',
    open,
  }));
}

describe('CourseDescriptionPanel', () => {
  it('keeps the animated description region mounted while collapsed', () => {
    const html = renderPanel(makeDetail({ cn: '中文简介', en: 'English description' }), false);

    expect(html).not.toContain('查看课程简介');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('course-description-region');
    expect(html).toContain('English description');
  });

  it('shows every available scraped description without another request', () => {
    const html = renderPanel(makeDetail({ cn: ' 中文简介 ', en: ' English description ' }), true);
    expect(html).toContain('中文简介');
    expect(html).toContain('English description');
    expect(html).toContain('course-description-region--open');
    expect(html).toContain('aria-hidden="false"');
  });

  it('places a borderless chevron toggle beside the modal title', () => {
    expect(panelSource).toContain('export function CourseDescriptionToggle');
    expect(panelSource).toContain('type="text"');
    expect(panelSource).toContain('course-description-toggle');
    expect(panelSource).toContain('ChevronIcon');
    expect(detailModalSource).toContain('titleExtra={');
    expect(detailModalSource).toContain('<CourseDescriptionToggle');
    expect(bottomModalSource).toContain('bottom-modal__title-extra');
    expect(bottomModalSource).toContain('headerLeading');
    expect(stylesSource).toContain('.course-description-region--open');
  });

  it('keeps the title controls inside the mobile modal header', () => {
    expect(detailModalSource).toContain('className="course-detail-modal"');
    expect(stylesSource).toContain('.course-detail-modal .bottom-modal__header');
    expect(stylesSource).toContain('grid-template-columns: minmax(0, 1fr) auto');
  });

  it('returns the modal body to the top when the description opens', () => {
    expect(bottomModalSource).toContain('bodyRef?: Ref<HTMLDivElement>');
    expect(detailModalSource).toContain('bodyRef={modalBodyRef}');
    expect(detailModalSource).toContain('scrollTo({ top: 0 })');
    expect(detailModalSource).not.toContain('window.requestAnimationFrame');
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

  it('decodes realistic named entities from scraped summer descriptions', () => {
    const html = renderPanel(makeDetail({
      cn: '',
      en: '<p>Probabilit&eacute;s discr&egrave;tes&emsp;&mdash;&emsp;D&eacute;nombrements</p>',
    }), true);

    expect(html).toContain('Probabilités discrètes — Dénombrements');
    expect(html).not.toContain('&amp;eacute;');
    expect(html).not.toContain('&amp;egrave;');
    expect(html).not.toContain('&amp;mdash;');
    expect(html).not.toContain('&amp;emsp;');
  });

  it('shows a clear empty state when neither description exists', () => {
    const html = renderPanel(makeDetail({ cn: ' ', en: '' }), true);
    expect(html).toContain('暂无课程简介');
  });
});
