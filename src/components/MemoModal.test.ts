// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MemoModal from './MemoModal';
import { MemosProvider } from '@/memos/MemosContext';
import { MEMOS_STORAGE_KEY } from '@/memos/memos';
import type { MemoNote, MemosState } from '@/types';

const cssSource = readFileSync('src/index.css', 'utf8');

vi.mock('@/store/plansContext', () => ({
  usePlans: () => ({
    state: { plans: [], activePlanId: null },
    activePlan: null,
    dispatch: vi.fn(),
  }),
}));
vi.mock('@/data/SemesterCatalogContext', () => ({
  useSemesterCatalog: () => ({
    courseMap: new Map(),
    groupsByCode: new Map(),
    manifest: { schemaVersion: 1, defaultSemester: 'test', semesters: [] },
    catalog: { schemaVersion: 1, generatedAt: '', source: {}, semester: {}, courses: [], detailsBySection: {}, revision: 'r' },
    courses: [],
    groups: [],
    groupByKey: new Map(),
    filterOptions: { departments: [], categories: [], levels: [], courseTypes: [], sectionTypes: [], examTypes: [], gradings: [], languages: [] },
    status: { phase: 'ready', targetSemesterKey: null, error: null },
    switchSemester: vi.fn(),
  }),
}));

async function mount(node: ReactNode): Promise<void> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function findButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.replace(/\s/g, '') === label.replace(/\s/g, ''),
  );
}

function seedMemos(notes: MemoNote[]): void {
  localStorage.setItem(
    MEMOS_STORAGE_KEY,
    JSON.stringify({ version: 1, notes } satisfies MemosState),
  );
}

function readStoredMemos(): MemosState | null {
  const serialized = localStorage.getItem(MEMOS_STORAGE_KEY);
  return serialized ? JSON.parse(serialized) as MemosState : null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('MemoModal', () => {
  it('renders title and empty state when open', async () => {
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );
    expect(document.querySelector('.bottom-modal')).toBeTruthy();
    expect(document.body.textContent).toContain('备忘录');
    expect(document.body.textContent).toContain('暂无备忘录');
  });

  it('renders nothing when closed', async () => {
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: false, onClose: () => {} })),
    );
    expect(document.querySelector('.bottom-modal')).toBeNull();
  });

  it('renders a two-pane workspace and selects the newest note', async () => {
    seedMemos([
      { id: 'note-1', text: '第一条备忘录', updatedAt: 1_753_344_000_000 },
      { id: 'note-2', text: '第二条备忘录', updatedAt: 0 },
    ]);

    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    expect(document.querySelector('.memo-modal__sidebar')).toBeTruthy();
    expect(document.querySelector('.memo-modal__workspace')).toBeTruthy();
    const rows = document.querySelectorAll<HTMLElement>('.memo-modal__nav-row');
    const deleteButtons = document.querySelectorAll<HTMLButtonElement>('.memo-modal__nav-delete');
    expect(rows).toHaveLength(2);
    expect(document.querySelectorAll('.memo-modal__nav-item')).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('第一条备忘录');
    expect(document.querySelector('.memo-modal__nav-item[aria-current="true"]')?.textContent)
      .toContain('第一条备忘录');
    expect(rows[0]?.classList.contains('memo-modal__nav-row--active')).toBe(true);
    expect(document.querySelectorAll('.memo-modal__nav-item time')).toHaveLength(1);
    const sidebar = document.querySelector('.memo-modal__sidebar');
    const workspace = document.querySelector('.memo-modal__workspace');
    const newButton = findButton('新建备忘录');
    expect(sidebar?.firstElementChild).toBe(newButton);
    expect(sidebar?.querySelector('.memo-modal__delete')).toBeNull();
    deleteButtons.forEach((button) => {
      expect(button.closest('.memo-modal__nav-row')).toBeTruthy();
      expect(button.getAttribute('aria-label')).toMatch(/^删除备忘录：/);
      expect(button.querySelector('svg')).toBeTruthy();
    });
    expect(workspace?.firstElementChild?.classList.contains('memo-modal__editor-shell'))
      .toBe(true);
    expect(findButton('添加')).toBeUndefined();
    expect(findButton('编辑')).toBeUndefined();
    expect(findButton('保存')).toBeUndefined();
    expect(document.querySelector('.memo-modal .bottom-modal__footer')).toBeNull();
  });

  it('creates a note from the first meaningful editor input and selects it', async () => {
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    await act(async () => {
      findButton('新建备忘录')!.click();
    });
    const editor = document.querySelector<HTMLTextAreaElement>('.memo-modal__editor');
    expect(editor).toBeTruthy();

    await act(async () => {
      setTextareaValue(editor!, '   ');
    });
    expect(readStoredMemos()).toBeNull();
    expect(document.querySelectorAll('.memo-modal__nav-item')).toHaveLength(0);

    await act(async () => {
      setTextareaValue(editor!, '新的选课提醒');
    });

    expect(readStoredMemos()?.notes.map((note) => note.text)).toEqual(['新的选课提醒']);
    expect(document.querySelectorAll('.memo-modal__nav-item')).toHaveLength(1);
    expect(document.querySelector('.memo-modal__nav-item[aria-current="true"]')?.textContent)
      .toContain('新的选课提醒');
    expect(editor!.value).toBe('新的选课提醒');
  });

  it('keeps recognition inside the editor surface and enables it after note creation', async () => {
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    const recognizeButton = findButton('识别课程');
    expect(recognizeButton).toBeTruthy();
    expect(recognizeButton?.closest('.memo-modal__editor-shell')).toBeTruthy();
    expect(recognizeButton?.closest('.memo-modal__recognize')).toBeTruthy();
    expect(recognizeButton?.closest('.memo-modal__toolbar')).toBeNull();
    expect(recognizeButton?.disabled).toBe(true);

    const editor = document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')!;
    await act(async () => {
      setTextareaValue(editor, '001101');
    });
    expect(findButton('识别课程')?.disabled).toBe(false);
  });

  it('persists edits immediately and labels a cleared note as blank', async () => {
    seedMemos([
      { id: 'note-1', text: '第一条备忘录', updatedAt: 20 },
      { id: 'note-2', text: '第二条备忘录', updatedAt: 10 },
    ]);
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    const noteButtons = document.querySelectorAll<HTMLButtonElement>('.memo-modal__nav-item');
    await act(async () => {
      noteButtons[1]!.click();
    });
    const editor = document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')!;
    expect(editor.value).toBe('第二条备忘录');

    await act(async () => {
      setTextareaValue(editor, '第二条已更新');
    });
    expect(readStoredMemos()?.notes.find((note) => note.id === 'note-2')?.text)
      .toBe('第二条已更新');

    await act(async () => {
      setTextareaValue(editor, '');
    });
    expect(readStoredMemos()?.notes.find((note) => note.id === 'note-2')?.text).toBe('');
    expect(document.querySelector('.memo-modal__nav-item[aria-current="true"]')?.textContent)
      .toContain('空白备忘录');
  });

  it('deletes an inactive row without changing the selected memo', async () => {
    seedMemos([
      { id: 'note-1', text: '第一条备忘录', updatedAt: 20 },
      { id: 'note-2', text: '第二条备忘录', updatedAt: 10 },
    ]);
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    await act(async () => {
      document.querySelectorAll<HTMLButtonElement>('.memo-modal__nav-delete')[1]!.click();
    });
    expect(readStoredMemos()?.notes.map((note) => note.id)).toEqual(['note-1', 'note-2']);
    expect(document.querySelector('.memo-delete-confirm[data-state="open"]')?.textContent)
      .toContain('第二条备忘录');
    expect(findButton('取消')).toBeTruthy();
    expect(findButton('删除')).toBeTruthy();
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('第一条备忘录');

    await act(async () => {
      findButton('删除')!.click();
    });
    expect(readStoredMemos()?.notes.map((note) => note.id)).toEqual(['note-1']);
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('第一条备忘录');
    expect(document.querySelector('.memo-modal__nav-item[aria-current="true"]')?.textContent)
      .toContain('第一条备忘录');
  });

  it('selects the next note after deleting the active row and returns to create mode when empty', async () => {
    seedMemos([
      { id: 'note-1', text: '第一条备忘录', updatedAt: 20 },
      { id: 'note-2', text: '第二条备忘录', updatedAt: 10 },
    ]);
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    await act(async () => {
      document.querySelector<HTMLButtonElement>('.memo-modal__nav-delete')!.click();
    });
    expect(readStoredMemos()?.notes.map((note) => note.id)).toEqual(['note-1', 'note-2']);
    expect(document.querySelector('.memo-delete-confirm[data-state="open"]')?.textContent)
      .toContain('第一条备忘录');

    await act(async () => {
      findButton('删除')!.click();
    });
    expect(readStoredMemos()?.notes.map((note) => note.id)).toEqual(['note-2']);
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('第二条备忘录');

    await act(async () => {
      document.querySelector<HTMLButtonElement>('.memo-modal__nav-delete')!.click();
    });
    expect(readStoredMemos()?.notes.map((note) => note.id)).toEqual(['note-2']);

    await act(async () => {
      findButton('删除')!.click();
    });
    expect(readStoredMemos()?.notes).toEqual([]);
    expect(document.querySelectorAll('.memo-modal__nav-item')).toHaveLength(0);
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value).toBe('');
    expect(document.querySelector('.memo-modal__nav-delete')).toBeNull();
  });

  it('defines the two-pane, focus, footer, and mobile layout contracts', () => {
    const sidebarRule = cssSource.match(/\.memo-modal__sidebar\s*\{([^}]*)\}/)?.[1] ?? '';
    const navRule = cssSource.match(/\.memo-modal__nav\s*\{([^}]*)\}/)?.[1] ?? '';
    const navDeleteRule = cssSource.match(
      /\.memo-modal__nav-delete\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const recognizeButtonRule = cssSource.match(
      /#root \.memo-modal \.memo-modal__recognize \.ant-btn\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const focusRule = cssSource.match(
      /\.memo-modal__editor:focus,\s*\.memo-modal__editor:focus-visible\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const mobileRule = cssSource.match(
      /@media \(max-width: 640px\)\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? '';

    expect(cssSource).toMatch(
      /\.memo-modal \.bottom-modal__panel\s*\{[^}]*height:\s*min\(74vh,\s*640px\);/,
    );
    expect(cssSource).toMatch(
      /\.memo-modal__body\s*\{[^}]*grid-template-columns:\s*minmax\([^;]+;/,
    );
    expect(cssSource).toMatch(/\.memo-modal__nav-row\s*\{[^}]*display:\s*grid;/);
    expect(navRule).toMatch(/padding:\s*0;/);
    expect(navRule).toContain('width: calc(100% + 8px)');
    expect(navRule).toContain('margin-right: -8px');
    expect(navRule).toContain('scrollbar-gutter: stable');
    expect(navDeleteRule).toContain('opacity: 0');
    expect(navDeleteRule).toContain('border: 0');
    expect(navDeleteRule).toContain('border-radius: var(--radius-sm)');
    expect(cssSource).toMatch(
      /\.memo-modal__nav-row--active \.memo-modal__nav-delete,[\s\S]*?opacity:\s*1;/,
    );
    expect(cssSource).toMatch(
      /\.memo-modal__editor-shell\s*\{[^}]*position:\s*relative;/,
    );
    expect(cssSource).toMatch(
      /\.memo-modal__recognize\s*\{[^}]*position:\s*absolute;[^}]*right:[^;]+;[^}]*bottom:[^;]+;/,
    );
    expect(cssSource).not.toMatch(/#root \.memo-modal__(?:new|nav-delete|recognize)/);
    expect(cssSource).toMatch(/\.memo-modal \.memo-modal__new\.ant-btn\s*\{/);
    expect(cssSource).toMatch(/\.memo-modal \.memo-modal__recognize \.ant-btn\s*\{/);
    expect(recognizeButtonRule).toContain('min-height: 30px');
    expect(recognizeButtonRule).toContain('padding-inline: 14px');
    expect(focusRule).toContain('outline: 0');
    expect(focusRule).toContain('box-shadow: none');
    expect(focusRule).toContain('border-color: var(--accent)');
    expect(focusRule).toContain('border-radius: var(--radius-xl)');
    expect(sidebarRule).not.toContain('border-right');
    expect(cssSource).toMatch(
      /@media \(max-width: 640px\)\s*\{[\s\S]*?\.memo-modal__body\s*\{[^}]*grid-template-columns:\s*1fr;/,
    );
    expect(mobileRule).toMatch(
      /\.memo-modal \.bottom-modal__panel\s*\{[^}]*height:\s*min\(84vh,\s*700px\);/,
    );
    expect(mobileRule).not.toContain('border-bottom');
    expect(cssSource).toContain('.memo-recognize__footer-actions');
  });
});
