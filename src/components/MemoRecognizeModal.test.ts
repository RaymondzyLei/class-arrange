// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MemoRecognizeModal from './MemoRecognizeModal';
import type { RecognizedRef } from '@/utils/courseRefs';

async function mount(node: ReactNode): Promise<void> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
}

function findButton(textContains: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent?.replace(/\s/g, '').includes(textContains.replace(/\s/g, '')),
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  document.body.innerHTML = '';
});

const refs: RecognizedRef[] = [
  { type: 'course', courseCode: '001101', courseName: '计算概论', sectionIds: ['001101.01', '001101.02'] },
  { type: 'section', sectionId: '001102.01', courseCode: '001102', courseName: '数据结构' },
];

describe('MemoRecognizeModal', () => {
  it('渲染识别项并默认全选导入', async () => {
    const onImport = vi.fn();
    await mount(createElement(MemoRecognizeModal, { open: true, refs, onClose: () => {}, onImport }));
    expect(document.body.textContent).toContain('计算概论');
    expect(document.body.textContent).toContain('001102.01');
    const importBtn = findButton('导入到新课表');
    expect(importBtn?.disabled).toBe(false);
    await act(async () => {
      importBtn!.click();
    });
    expect(onImport).toHaveBeenCalledWith(['001101.01', '001101.02', '001102.01']);
  });

  it('无识别项时显示空状态', async () => {
    await mount(createElement(MemoRecognizeModal, { open: true, refs: [], onClose: () => {}, onImport: () => {} }));
    expect(document.body.textContent).toContain('未识别到');
  });

  it('关闭时不渲染', async () => {
    await mount(createElement(MemoRecognizeModal, { open: false, refs, onClose: () => {}, onImport: () => {} }));
    expect(document.querySelector('.bottom-modal')).toBeNull();
  });

  it('展开课程分组显示班次', async () => {
    await mount(createElement(MemoRecognizeModal, { open: true, refs, onClose: () => {}, onImport: () => {} }));
    const expandBtn = findButton('展开');
    await act(async () => {
      expandBtn!.click();
    });
    expect(document.body.textContent).toContain('001101.01');
    expect(document.body.textContent).toContain('001101.02');
  });
});
