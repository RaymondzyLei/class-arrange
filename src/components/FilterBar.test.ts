// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FilterBar from './FilterBar';
import { FindCoursesIcon } from './icons';
import { MemosProvider } from '@/memos/MemosContext';

const filterBarSource = readFileSync(resolve('src/components/FilterBar.tsx'), 'utf8');
const appSource = readFileSync(resolve('src/App.tsx'), 'utf8');
const cssSource = readFileSync(resolve('src/index.css'), 'utf8');

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
  it('uses the existing small button primitive for the memo entry', () => {
    const html = renderToStaticMarkup(createElement(MemosProvider, null, createElement(FilterBar, {
      filter,
      setFilter: vi.fn(),
      options,
      onOpenMemo: vi.fn(),
      onOpenFinder: vi.fn(),
    } as Parameters<typeof FilterBar>[0])));

    expect(html).toMatch(
      /<button[^>]*class="[^"]*\bant-btn\b[^"]*\bant-btn-sm\b[^"]*\bfilter-bar__memo-toggle\b[^"]*"[^>]*>/,
    );

    const triggerRule = cssSource.match(
      /#root \.filter-bar__memo-toggle\.ant-btn\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const focusRule = cssSource.match(
      /#root \.filter-bar__memo-toggle\.ant-btn:focus-visible\s*\{([^}]*)\}/,
    )?.[1] ?? '';

    expect(cssSource).toMatch(
      /#root \.ant-btn:not\([^}]*\)\s*\{[^}]*min-height:\s*var\(--action-chip-height\);/s,
    );
    expect(triggerRule).not.toMatch(/(?:^|[;\s])height\s*:/);
    expect(triggerRule).not.toContain('min-height:');
    expect(focusRule).toContain('outline: 0');
    expect(focusRule).not.toContain('border-color:');
    expect(focusRule).not.toContain('background:');
    expect(focusRule).not.toContain('border-radius:');
    expect(focusRule).toContain('box-shadow: none');
  });

  it('places teacher search beside the input and removes result counts', () => {
    const html = renderToStaticMarkup(createElement(MemosProvider, null, createElement(FilterBar, {
      filter,
      setFilter: vi.fn(),
      options,
      onOpenMemo: vi.fn(),
      onOpenFinder: vi.fn(),
    } as Parameters<typeof FilterBar>[0])));

    const teacherToggleIndex = html.indexOf('filter-bar__teacher-toggle');
    const controlsIndex = html.indexOf('filter-bar__controls');

    expect(html).toContain('查询任课老师');
    expect(teacherToggleIndex).toBeGreaterThan(0);
    expect(teacherToggleIndex).toBeLessThan(controlsIndex);
    expect(html).not.toContain('共 ');
    expect(filterBarSource).not.toContain('resultCount');
    expect(appSource).not.toContain('resultCount={filteredGroups.length}');
  });

  it('places the time finder between the search input and teacher checkbox', () => {
    const html = renderToStaticMarkup(createElement(MemosProvider, null, createElement(FilterBar, {
      filter,
      setFilter: vi.fn(),
      options,
      onOpenMemo: vi.fn(),
      onOpenFinder: vi.fn(),
    } as Parameters<typeof FilterBar>[0])));

    const inputIndex = html.indexOf('<input');
    const finderIndex = html.indexOf('aria-label="按时间寻找课程"');
    const teacherToggleIndex = html.indexOf('filter-bar__teacher-toggle');

    expect(inputIndex).toBeGreaterThan(0);
    expect(finderIndex).toBeGreaterThan(inputIndex);
    expect(teacherToggleIndex).toBeGreaterThan(finderIndex);
  });

  it('renders the time finder as a neutral control with the same height as the search input', () => {
    const html = renderToStaticMarkup(createElement(MemosProvider, null, createElement(FilterBar, {
      filter,
      setFilter: vi.fn(),
      options,
      onOpenMemo: vi.fn(),
      onOpenFinder: vi.fn(),
    } as Parameters<typeof FilterBar>[0])));
    const finderMarkup = html.match(
      /<button[^>]*aria-label="按时间寻找课程"[^>]*>/,
    )?.[0] ?? '';

    expect(finderMarkup).not.toContain('ant-btn-primary');
    expect(cssSource).toMatch(
      /\.filter-bar__search\s*\{[^}]*--filter-search-control-height:\s*32px;/s,
    );
    expect(cssSource).toMatch(
      /\.filter-bar__search \.ant-input-affix-wrapper\s*\{[^}]*height:\s*var\(--filter-search-control-height\);/s,
    );
    expect(cssSource).toMatch(
      /#root \.filter-bar__search \.filter-bar__find-button\.ant-btn\.ant-btn-default\s*\{[^}]*height:\s*var\(--filter-search-control-height\);/s,
    );
    expect(cssSource).toMatch(
      /#root \.filter-bar__search \.filter-bar__find-button\.ant-btn\.ant-btn-default\s*\{[^}]*background:\s*#fff;[^}]*color:\s*var\(--text\);/s,
    );
  });

  it('renders the reference magnifier with one large and one small four-point sparkle', () => {
    const icon = renderToStaticMarkup(createElement(FindCoursesIcon));

    expect(icon).toContain(
      '<circle cx="9.25" cy="12.25" r="5.45" stroke="currentColor" stroke-width="1.55"></circle>',
    );
    expect(icon).toContain(
      '<path d="M13.2 16.2 18.25 21.25" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>',
    );
    expect(icon).toContain(
      '<path d="M17.1 1.9C17.35 4.2 18.9 5.75 21.2 6c-2.3.25-3.85 1.8-4.1 4.15-.25-2.35-1.8-3.9-4.1-4.15 2.3-.25 3.85-1.8 4.1-4.1Z" fill="currentColor"></path>',
    );
    expect(icon).toContain(
      '<path d="M20.25 7.8c.1.9.8 1.6 1.7 1.7-.9.1-1.6.8-1.7 1.7-.1-.9-.8-1.6-1.7-1.7.9-.1 1.6-.8 1.7-1.7Z" fill="currentColor"></path>',
    );
  });

  it('opens the time finder from its dedicated entry', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    const root = createRoot(host);
    const onOpenFinder = vi.fn();

    await act(async () => {
      root.render(createElement(FilterBar, {
        filter,
        setFilter: vi.fn(),
        options,
        onOpenMemo: vi.fn(),
        onOpenFinder,
      } as Parameters<typeof FilterBar>[0]));
    });

    const finder = host.querySelector<HTMLButtonElement>(
      'button[aria-label="按时间寻找课程"]',
    );
    expect(finder).not.toBeNull();

    act(() => {
      finder?.click();
    });
    expect(onOpenFinder).toHaveBeenCalledOnce();

    await act(async () => {
      root.unmount();
    });
  });

  it('reserves a fixed finder column while the input takes the remainder', () => {
    expect(cssSource).toMatch(
      /\.filter-bar__search\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--filter-search-control-height\) max-content;/s,
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
    const html = renderToStaticMarkup(createElement(MemosProvider, null, createElement(FilterBar, {
      filter: { ...filter, category: '专业课', level: '本研贯通' },
      setFilter: vi.fn(),
      options,
      onOpenMemo: vi.fn(),
      onOpenFinder: vi.fn(),
    } as Parameters<typeof FilterBar>[0])));

    expect(filterBarSource).toContain('placeholder="课程范畴"');
    expect(filterBarSource).toContain('placeholder="学历层次"');
    expect(html).toContain('专业课');
    expect(html).toContain('本研贯通');
  });
});
