import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SemesterDropdown from './SemesterDropdown';

const stylesSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('SemesterDropdown', () => {
  const semesters = [
    {
      key: '2026-fall',
      name: '2026年秋季学期',
      file: '2026-fall/courses.json',
      revision: 'fall-r1',
      updatesFile: '2026-fall/updates.json',
    },
    {
      key: '2026-summer',
      name: '2026年夏季学期',
      file: '2026-summer/courses.json',
      revision: 'summer-r1',
      updatesFile: '2026-summer/updates.json',
    },
  ];

  it('uses one complete button for the current semester label and chevron', () => {
    const html = renderToStaticMarkup(createElement(SemesterDropdown, {
      semesters,
      semesterKey: '2026-fall',
      loading: false,
      onSelect: vi.fn(),
    }));

    expect(html).toContain('aria-label="选择学期"');
    const trigger = html.match(
      /<button[^>]*course-table__semester-toggle[^>]*>[\s\S]*?<\/button>/,
    )?.[0] ?? '';

    expect(trigger).toContain('2026年秋季学期');
    expect(trigger).toContain('class="ant-btn-icon"');
    expect(trigger).toContain('class="select-chevron"');
  });

  it('keeps the chevron mounted while the next semester is loading', () => {
    const html = renderToStaticMarkup(createElement(SemesterDropdown, {
      semesters,
      semesterKey: '2026-fall',
      loading: true,
      onSelect: vi.fn(),
    }));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('select-chevron');
    expect(html).not.toContain('ant-btn-loading-icon');
  });

  it('left-aligns the label and centers the chevron in its own slot', () => {
    const triggerRule = stylesSource.match(
      /#root \.course-table__semester-toggle\.ant-btn\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';
    const labelRule = stylesSource.match(
      /\.course-table__semester-toggle \.course-table__term-name\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';
    const iconRule = stylesSource.match(
      /\.course-table__semester-toggle \.ant-btn-icon\s*\{([\s\S]*?)\}/,
    )?.[1] ?? '';

    expect(triggerRule).toContain('justify-content: space-between');
    expect(triggerRule).toContain('text-align: left');
    expect(labelRule).toContain('transform: translateY(-1px)');
    expect(iconRule).toContain('align-items: center');
    expect(iconRule).toContain('justify-content: center');
  });
});
