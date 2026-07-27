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

function findButtonByLabel(label: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

function findComplexFormatToggle(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(
    'button[role="switch"][aria-label="复杂格式"]',
  )!;
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

  it('uses the settings switch beside the title to move between simple and complex editors', async () => {
    seedMemos([
      { id: 'note-1', text: '**重点**', updatedAt: 20 },
    ]);
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    const toggle = document.querySelector<HTMLButtonElement>(
      'button[role="switch"][aria-label="复杂格式"]',
    );
    expect(toggle).toBeTruthy();
    expect(toggle?.closest('.bottom-modal__title-extra')).toBeTruthy();
    expect(toggle?.classList.contains('customization__preference-toggle')).toBe(true);
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.parentElement?.textContent).toContain('复杂格式');
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('**重点**');
    expect(document.querySelector('.memo-modal__format-toolbar')).toBeNull();
    expect(findButton('识别课程')?.closest('.memo-modal__recognize')).toBeTruthy();

    await act(async () => {
      toggle!.click();
    });

    expect(toggle?.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('.memo-modal__markdown-preview strong')?.textContent)
      .toBe('重点');
    expect(document.querySelector('.memo-modal__editor')).toBeNull();
    expect(findButton('识别课程')?.closest('.memo-modal__mode-actions')).toBeTruthy();

    await act(async () => {
      toggle!.click();
    });
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('**重点**');
    expect(document.querySelector('.memo-modal__format-toolbar')).toBeNull();
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
    expect(document.querySelector('.memo-modal__markdown-preview')).toBeNull();
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
    expect(findButton('完成')).toBeUndefined();
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

  it('places recognition after the edit action with the same toolbar button style', async () => {
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    await act(async () => {
      findComplexFormatToggle().click();
    });

    const recognizeButton = findButton('识别课程');
    expect(recognizeButton).toBeTruthy();
    expect(recognizeButton?.closest('.memo-modal__editor-shell')).toBeTruthy();
    const actionGroup = recognizeButton?.closest('.memo-modal__mode-actions');
    expect(actionGroup?.closest('.memo-modal__format-toolbar')).toBeTruthy();
    expect(
      Array.from(actionGroup?.querySelectorAll('button') ?? [], (button) => button.textContent),
    ).toEqual(['完成', '识别课程']);
    expect(recognizeButton?.classList.contains('memo-modal__mode-button')).toBe(true);
    expect(document.querySelector('.memo-modal__recognize')).toBeNull();
    expect(recognizeButton?.disabled).toBe(true);

    const editor = document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')!;
    await act(async () => {
      setTextareaValue(editor, '001101');
    });
    expect(findButton('识别课程')?.disabled).toBe(false);
  });

  it('formats the current selection from the top toolbar and saves it immediately', async () => {
    seedMemos([
      { id: 'note-1', text: '课程 001101', updatedAt: 20 },
    ]);
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    await act(async () => {
      findComplexFormatToggle().click();
    });
    await act(async () => {
      findButton('编辑')!.click();
    });

    const toolbar = document.querySelector('.memo-modal__format-toolbar');
    const editor = document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')!;
    expect(toolbar).toBeTruthy();
    expect(findButtonByLabel('标题')).toBeTruthy();
    expect(findButtonByLabel('加粗')).toBeTruthy();
    expect(findButtonByLabel('斜体')).toBeTruthy();
    expect(findButtonByLabel('待办列表')).toBeTruthy();
    expect(findButton('完成')).toBeTruthy();

    editor.focus();
    editor.setSelectionRange(3, 9);
    await act(async () => {
      findButtonByLabel('加粗')!.click();
    });

    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('课程 **001101**');
    expect(readStoredMemos()?.notes[0]?.text).toBe('课程 **001101**');

    expect(findButtonByLabel('加粗')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      findButtonByLabel('加粗')!.click();
    });
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toBe('课程 001101');
    expect(readStoredMemos()?.notes[0]?.text).toBe('课程 001101');
    expect(findButtonByLabel('加粗')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens saved notes in a safe GFM preview and returns to preview after editing is complete', async () => {
    seedMemos([
      {
        id: 'note-1',
        text: '**重点**\n- [ ] 记得选课\n<div id="unsafe">内容</div>',
        updatedAt: 20,
      },
    ]);
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    await act(async () => {
      findComplexFormatToggle().click();
    });

    const preview = document.querySelector('.memo-modal__markdown-preview');
    expect(preview?.querySelector('strong')?.textContent).toBe('重点');
    expect(preview?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled)
      .toBe(true);
    expect(preview?.querySelector('#unsafe')).toBeNull();
    expect(document.querySelector('.memo-modal__editor')).toBeNull();

    await act(async () => {
      findButton('编辑')!.click();
    });
    expect(document.querySelector<HTMLTextAreaElement>('.memo-modal__editor')?.value)
      .toContain('**重点**');

    await act(async () => {
      findButton('完成')!.click();
    });
    expect(document.querySelector('.memo-modal__editor')).toBeNull();
    expect(document.querySelector('.memo-modal__markdown-preview strong')?.textContent)
      .toBe('重点');
    expect(findButton('编辑')).toBeTruthy();
    expect(findButton('完成')).toBeUndefined();
  });

  it('pins favorited memos while preserving order and the current selection', async () => {
    seedMemos([
      { id: 'note-1', text: '第一条', updatedAt: 30 },
      { id: 'note-2', text: '第二条', updatedAt: 20, favorite: true },
      { id: 'note-3', text: '第三条', updatedAt: 10 },
    ]);
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );

    const previews = () => Array.from(
      document.querySelectorAll('.memo-modal__preview'),
      (node) => node.textContent,
    );
    expect(previews()).toEqual(['第二条', '第一条', '第三条']);
    expect(document.querySelector('.memo-modal__nav-item[aria-current="true"]')?.textContent)
      .toContain('第二条');
    expect(document.querySelectorAll('.memo-modal__nav-favorite')).toHaveLength(3);
    expect(
      document.querySelector<HTMLButtonElement>('.memo-modal__nav-favorite')?.getAttribute('aria-pressed'),
    ).toBe('true');

    await act(async () => {
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="收藏备忘录：第三条"]',
      )!.click();
    });

    expect(previews()).toEqual(['第二条', '第三条', '第一条']);
    expect(document.querySelector('.memo-modal__nav-item[aria-current="true"]')?.textContent)
      .toContain('第二条');
    expect(readStoredMemos()?.notes.find((note) => note.id === 'note-3')?.favorite)
      .toBe(true);

    await act(async () => {
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="取消收藏备忘录：第三条"]',
      )!.click();
    });
    expect(previews()).toEqual(['第二条', '第一条', '第三条']);
    expect(readStoredMemos()?.notes.find((note) => note.id === 'note-3')?.favorite)
      .toBeUndefined();
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
    const modeButtonRule = cssSource.match(
      /#root \.memo-modal \.memo-modal__mode-button\.ant-btn\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const simpleEditorRule = cssSource.match(
      /\.memo-modal__editor--simple\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const recognizeButtonRule = cssSource.match(
      /#root \.memo-modal \.memo-modal__recognize \.ant-btn\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const editorShellRule = cssSource.match(
      /\.memo-modal__editor-shell\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const shellFocusRule = cssSource.match(
      /\.memo-modal__editor-shell:focus-within\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const toolbarRule = cssSource.match(
      /\.memo-modal__format-toolbar\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const editorRule = cssSource.match(
      /\.memo-modal__editor\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const previewRule = cssSource.match(
      /\.memo-modal__markdown-preview\s*\{([^}]*)\}/,
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
    expect(editorShellRule).toContain('display: flex');
    expect(editorShellRule).toContain('border: 1px solid var(--border)');
    expect(editorShellRule).toContain('border-radius: var(--radius-xl)');
    expect(editorShellRule).toContain('overflow: hidden');
    expect(shellFocusRule).toContain('border-color: var(--accent)');
    expect(shellFocusRule).toContain('box-shadow: none');
    expect(toolbarRule).toContain('border-bottom: 1px solid var(--border)');
    expect(editorRule).toContain('border: 0');
    expect(previewRule).toContain('overflow: auto');
    expect(cssSource).toMatch(
      /\.memo-modal__format-actions\s*\{[^}]*overflow-x:\s*auto;/,
    );
    expect(simpleEditorRule).toContain('border: 1px solid var(--border)');
    expect(simpleEditorRule).toContain('border-radius: var(--radius-xl)');
    expect(cssSource).toMatch(
      /\.memo-modal__recognize\s*\{[^}]*position:\s*absolute;[^}]*right:[^;]+;[^}]*bottom:[^;]+;/,
    );
    expect(cssSource).not.toMatch(/#root \.memo-modal__(?:new|nav-delete|recognize)/);
    expect(cssSource).toMatch(/\.memo-modal \.memo-modal__new\.ant-btn\s*\{/);
    expect(modeButtonRule).toContain('min-height: 28px');
    expect(modeButtonRule).toContain('padding-inline: 10px');
    expect(recognizeButtonRule).toContain('min-height: 38px');
    expect(recognizeButtonRule).toContain('padding-inline: 18px');
    expect(sidebarRule).not.toContain('border-right');
    expect(cssSource).toMatch(
      /@media \(max-width: 640px\)\s*\{[\s\S]*?\.memo-modal__body\s*\{[^}]*grid-template-columns:\s*1fr;/,
    );
    expect(cssSource).toMatch(
      /\.memo-modal \.bottom-modal__panel\s*\{\s*height:\s*min\(84vh,\s*700px\);\s*\}/,
    );
    expect(cssSource).not.toMatch(/\.memo-modal__sidebar\s*\{[^}]*border-bottom:/);
    expect(cssSource).toContain('.memo-recognize__footer-actions');
  });
});
