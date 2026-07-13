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
  courseType: '',
  sectionType: '',
  examType: '',
  grading: '',
  language: '',
  includeTeacher: false,
};

const options = {
  departments: [],
  courseTypes: [],
  sectionTypes: [],
  examTypes: [],
  gradings: [],
  languages: [],
};

describe('FilterBar search row', () => {
  it('shares one panel with the calculation status', () => {
    expect(appSource).toMatch(
      /className="panel-inner course-search-controls no-print"[\s\S]*<CalculationStatus[\s\S]*<FilterBar/,
    );
    expect(filterBarSource).not.toContain('panel-inner filter-bar');
  });

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
});
