import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SemesterDropdown from './SemesterDropdown';

describe('SemesterDropdown', () => {
  it('uses the Ant Design icon slot so the chevron cannot collapse to zero width', () => {
    const html = renderToStaticMarkup(createElement(SemesterDropdown, {
      semesters: [
        { key: '2026-fall', name: '2026年秋季学期', file: '2026-fall/courses.json' },
        { key: '2026-summer', name: '2026年夏季学期', file: '2026-summer/courses.json' },
      ],
      semesterKey: '2026-fall',
      loading: false,
      onSelect: vi.fn(),
    }));

    expect(html).toContain('aria-label="选择学期"');
    expect(html).toContain('class="ant-btn-icon"');
    expect(html).toContain('class="select-chevron"');
  });
});
