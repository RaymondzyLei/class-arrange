import { Button } from 'antd';
import type { ReactNode } from 'react';
import { PaperclipIcon } from './icons';
import type { MemoMarkdownFormat } from '@/memos/markdown';

export type MemoEditorMode = 'edit' | 'preview';

interface Props {
  mode: MemoEditorMode;
  activeFormats: ReadonlySet<MemoMarkdownFormat>;
  recognizeAction: ReactNode;
  onFormat: (format: MemoMarkdownFormat) => void;
  onModeChange: (mode: MemoEditorMode) => void;
}

interface FormatAction {
  format: MemoMarkdownFormat;
  label: string;
  mark: ReactNode;
}

const FORMAT_ACTIONS: FormatAction[] = [
  { format: 'heading', label: '标题', mark: 'H' },
  { format: 'bold', label: '加粗', mark: <strong>B</strong> },
  { format: 'italic', label: '斜体', mark: <em>I</em> },
  { format: 'strikethrough', label: '删除线', mark: <s>S</s> },
  { format: 'unordered-list', label: '无序列表', mark: '•' },
  { format: 'ordered-list', label: '有序列表', mark: '1.' },
  { format: 'task-list', label: '待办列表', mark: '☑' },
  { format: 'blockquote', label: '引用', mark: '❝' },
  { format: 'inline-code', label: '行内代码', mark: '</>' },
  {
    format: 'link',
    label: '插入链接',
    mark: <PaperclipIcon />,
  },
];

export default function MemoMarkdownToolbar({
  mode,
  activeFormats,
  recognizeAction,
  onFormat,
  onModeChange,
}: Props) {
  return (
    <div className="memo-modal__format-toolbar" role="toolbar" aria-label="备忘录格式">
      <div className="memo-modal__format-actions">
        {mode === 'edit'
          ? FORMAT_ACTIONS.map((action) => {
            const active = activeFormats.has(action.format);
            return (
              <Button
                key={action.format}
                type="text"
                size="small"
                className={`memo-modal__format-button${active ? ' memo-modal__format-button--active' : ''}`}
                aria-label={action.label}
                aria-pressed={active}
                title={action.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onFormat(action.format)}
              >
                <span className="memo-modal__format-mark" aria-hidden="true">
                  {action.mark}
                </span>
              </Button>
            );
          })
          : null}
      </div>
      <div className="memo-modal__mode-actions" role="group" aria-label="备忘录操作">
        <Button
          type="text"
          size="small"
          className="memo-modal__mode-button"
          onClick={() => onModeChange(mode === 'edit' ? 'preview' : 'edit')}
        >
          {mode === 'edit' ? '完成' : '编辑'}
        </Button>
        {recognizeAction}
      </div>
    </div>
  );
}
