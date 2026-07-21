import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FilterBar from './FilterBar';

const filterBarSource = readFileSync(new URL('./FilterBar.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

const filter = {
  keyword: '',
  department: '',
  category: '',
  level: '',
  courseType: '',
  sectionType: '',
  examType: '',
  grading: '',
  language: '',
  includeTeacher: false,
};

const options = {
  departments: [],
  categories: ['专业课'],
  levels: ['本科', '研究生', '本研贯通'],
  courseTypes: [],
  sectionTypes: [],
  examTypes: [],
  gradings: [],
  languages: [],
};

describe('FilterBar search row', () => {
  it('places teacher search beside the input and removes result counts', () => {
    const html = renderToStaticMarkup(createElement(FilterBar, {
      filter,
      setFilter: vi.fn(),
      options,
    } as Parameters<typeof FilterBar>[0]));

    const teacherToggleIndex = html.indexOf('filter-bar__teacher-toggle');
    const controlsIndex = html.indexOf('filter-bar__controls');

    expect(html).toContain('查询任课老师');
    expect(teacherToggleIndex).toBeGreaterThan(0);
    expect(teacherToggleIndex).toBeLessThan(controlsIndex);
    expect(html).not.toContain('共 ');
    expect(filterBarSource).not.toContain('resultCount');
    expect(appSource).not.toContain('resultCount={filteredGroups.length}');
  });

  it('reserves only the checkbox width and lets the input take the remainder', () => {
    expect(cssSource).toMatch(
      /\.filter-bar__search\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) max-content;/s,
    );
    expect(cssSource).not.toContain('.filter-bar__count');
  });

  it('keeps all three filter controls equally responsive across viewports', () => {
    const controlsRules = [...cssSource.matchAll(/\.filter-bar__controls\s*\{([^}]*)\}/g)];

    expect(controlsRules).toHaveLength(2);
    controlsRules.forEach(([, declarations]) => {
      expect(declarations).toMatch(
        /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/,
      );
    });
  });

  it('offers course category and education level filters', () => {
    const html = renderToStaticMarkup(createElement(FilterBar, {
      filter: { ...filter, category: '专业课', level: '本研贯通' },
      setFilter: vi.fn(),
      options,
    } as Parameters<typeof FilterBar>[0]));

    expect(filterBarSource).toContain('placeholder="课程范畴"');
    expect(filterBarSource).toContain('placeholder="学历层次"');
    expect(html).toContain('专业课');
    expect(html).toContain('本研贯通');
  });
});
