// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MemoModal from './MemoModal';
import { MemosProvider } from '@/memos/MemosContext';

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

  it('adds a note via the compose area', async () => {
    await mount(
      createElement(MemosProvider, null, createElement(MemoModal, { open: true, onClose: () => {} })),
    );
    const textarea = document.querySelector<HTMLTextAreaElement>('.memo-modal__compose textarea');
    expect(textarea).toBeTruthy();
    await act(async () => {
      setTextareaValue(textarea!, '选课提醒');
    });

    const addBtn = document.querySelector<HTMLButtonElement>('.memo-modal__compose button');
    expect(addBtn).toBeTruthy();
    expect(addBtn!.disabled).toBe(false);
    await act(async () => {
      addBtn!.click();
    });

    expect(document.body.textContent).toContain('选课提醒');
    expect(document.body.textContent).not.toContain('暂无备忘录');
  });
});
