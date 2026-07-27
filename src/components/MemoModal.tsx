import { Button } from 'antd';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BottomModal from './BottomModal';
import { FavoriteButton } from './FavoriteButton';
import { PlusIcon, TrashIcon } from './icons';
import MemoMarkdownToolbar, { type MemoEditorMode } from './MemoMarkdownToolbar';
import MemoRecognizeButton from './MemoRecognizeButton';
import { PreferenceToggleButton } from './onboarding/PreferenceSwitch';
import {
  applyMemoMarkdownFormat,
  continueMemoOrderedList,
  isMemoMarkdownFormatActive,
  MEMO_MARKDOWN_FORMATS,
  normalizeMemoOrderedLists,
  type MemoMarkdownEdit,
  type MemoMarkdownFormat,
} from '@/memos/markdown';
import { useMemos } from '@/memos/MemosContext';
import type { MemoNote } from '@/types';

interface Props {
  open: boolean;
  initialNoteId?: string | null;
  onClose: () => void;
}

const memoTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function memoPreview(text: string): string {
  return text.trim().split(/\r?\n/, 1)[0] || '空白备忘录';
}

function memoUpdatedAt(updatedAt: number): string | null {
  return updatedAt > 0 ? memoTimeFormatter.format(new Date(updatedAt)) : null;
}

export default function MemoModal({ open, initialNoteId = null, onClose }: Props) {
  const { notes, addNote, updateNote, toggleFavorite, removeNote } = useMemos();
  const orderedNotes = useMemo(
    () => notes
      .map((note, index) => ({ note, index }))
      .sort(
        (left, right) => (
          Number(Boolean(right.note.favorite)) - Number(Boolean(left.note.favorite))
          || left.index - right.index
        ),
      )
      .map(({ note }) => note),
    [notes],
  );
  const initialNote = (
    initialNoteId
      ? orderedNotes.find((note) => note.id === initialNoteId)
      : null
  ) ?? orderedNotes[0] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialNote?.id ?? null);
  const [creating, setCreating] = useState(initialNote === null);
  const [editorText, setEditorText] = useState(initialNote?.text ?? '');
  const [editorMode, setEditorMode] = useState<MemoEditorMode>(
    initialNote ? 'preview' : 'edit',
  );
  const [complexFormat, setComplexFormat] = useState(false);
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0 });
  const [deleteTarget, setDeleteTarget] = useState<MemoNote | null>(null);
  const wasOpenRef = useRef(false);
  const newNoteRequestedRef = useRef(false);
  const pendingNewTextRef = useRef<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const activeNote = useMemo(
    () => (creating ? null : notes.find((note) => note.id === selectedId) ?? null),
    [creating, notes, selectedId],
  );
  const activeFormats = useMemo(
    () => new Set(
      MEMO_MARKDOWN_FORMATS.filter((format) => isMemoMarkdownFormatActive(
        editorText,
        editorSelection.start,
        editorSelection.end,
        format,
      )),
    ),
    [editorSelection.end, editorSelection.start, editorText],
  );

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open) {
      setDeleteTarget(null);
      return;
    }
    if (wasOpen) return;

    const firstNote = (
      initialNoteId
        ? orderedNotes.find((note) => note.id === initialNoteId)
        : null
    ) ?? orderedNotes[0] ?? null;
    setCreating(firstNote === null);
    setSelectedId(firstNote?.id ?? null);
    setEditorText(firstNote?.text ?? '');
    setEditorMode(firstNote ? 'preview' : 'edit');
    setEditorSelection({ start: 0, end: 0 });
    newNoteRequestedRef.current = false;
    pendingNewTextRef.current = null;
    pendingSelectionRef.current = null;
    setDeleteTarget(null);
  }, [initialNoteId, open, orderedNotes]);

  useEffect(() => {
    if (!newNoteRequestedRef.current) return;
    const createdNote = notes[0];
    if (!createdNote) return;

    const pendingText = pendingNewTextRef.current ?? createdNote.text;
    newNoteRequestedRef.current = false;
    pendingNewTextRef.current = null;
    setCreating(false);
    setSelectedId(createdNote.id);
    setEditorText(pendingText);
    setEditorSelection({ start: pendingText.length, end: pendingText.length });
    if (pendingText !== createdNote.text) {
      updateNote(createdNote.id, pendingText);
    }
  }, [notes, updateNote]);

  useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    if (!pendingSelection || editorMode !== 'edit' || !editorRef.current) return;
    editorRef.current.focus();
    editorRef.current.setSelectionRange(pendingSelection.start, pendingSelection.end);
    setEditorSelection(pendingSelection);
    pendingSelectionRef.current = null;
  }, [editorMode, editorText]);

  const startNewNote = () => {
    newNoteRequestedRef.current = false;
    pendingNewTextRef.current = null;
    pendingSelectionRef.current = null;
    setCreating(true);
    setSelectedId(null);
    setEditorText('');
    setEditorMode('edit');
    setEditorSelection({ start: 0, end: 0 });
  };

  const selectNote = (note: MemoNote) => {
    newNoteRequestedRef.current = false;
    pendingNewTextRef.current = null;
    pendingSelectionRef.current = null;
    setCreating(false);
    setSelectedId(note.id);
    setEditorText(note.text);
    setEditorMode('preview');
    setEditorSelection({ start: 0, end: 0 });
  };

  const commitEditorText = (text: string) => {
    setEditorText(text);

    if (creating) {
      pendingNewTextRef.current = text;
      if (!newNoteRequestedRef.current && text.trim()) {
        newNoteRequestedRef.current = true;
        addNote(text);
      }
      return;
    }

    if (selectedId) updateNote(selectedId, text);
  };

  const handleEditorChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    commitEditorText(event.target.value);
    setEditorSelection({
      start: event.target.selectionStart,
      end: event.target.selectionEnd,
    });
  };

  const commitMarkdownEdit = (edit: MemoMarkdownEdit) => {
    pendingSelectionRef.current = {
      start: edit.selectionStart,
      end: edit.selectionEnd,
    };
    setEditorSelection({
      start: edit.selectionStart,
      end: edit.selectionEnd,
    });
    commitEditorText(edit.text);
  };

  const handleComplexEditorChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const edit = normalizeMemoOrderedLists(
      event.target.value,
      event.target.selectionStart,
      event.target.selectionEnd,
    );
    if (edit.text !== event.target.value) {
      pendingSelectionRef.current = {
        start: edit.selectionStart,
        end: edit.selectionEnd,
      };
    }
    setEditorSelection({
      start: edit.selectionStart,
      end: edit.selectionEnd,
    });
    commitEditorText(edit.text);
  };

  const handleComplexEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter'
      || event.shiftKey
      || event.ctrlKey
      || event.metaKey
      || event.altKey
      || event.nativeEvent.isComposing
    ) {
      return;
    }

    const edit = continueMemoOrderedList(
      editorText,
      event.currentTarget.selectionStart,
      event.currentTarget.selectionEnd,
    );
    if (!edit) return;

    event.preventDefault();
    commitMarkdownEdit(edit);
  };

  const handleFormat = (format: MemoMarkdownFormat) => {
    const editor = editorRef.current;
    if (!editor) return;
    const edit = applyMemoMarkdownFormat(
      editorText,
      editor.selectionStart,
      editor.selectionEnd,
      format,
    );
    commitMarkdownEdit(edit);
  };

  const syncEditorSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setEditorSelection({
      start: editor.selectionStart,
      end: editor.selectionEnd,
    });
  };

  const handleComplexFormatChange = (checked: boolean) => {
    pendingSelectionRef.current = null;
    setComplexFormat(checked);
    if (checked) setEditorMode(creating ? 'edit' : 'preview');
  };

  const handleEditorModeChange = (mode: MemoEditorMode) => {
    if (mode === 'edit') {
      const edit = normalizeMemoOrderedLists(
        editorText,
        editorSelection.start,
        editorSelection.end,
      );
      if (edit.text !== editorText) commitMarkdownEdit(edit);
    }
    setEditorMode(mode);
  };

  const deleteNote = (note: MemoNote) => {
    const noteIndex = orderedNotes.findIndex((candidate) => candidate.id === note.id);
    const remaining = orderedNotes.filter((candidate) => candidate.id !== note.id);
    removeNote(note.id);

    if (activeNote?.id !== note.id) return;

    if (remaining.length === 0) {
      startNewNote();
      return;
    }

    const nextNote = remaining[Math.min(noteIndex, remaining.length - 1)] ?? remaining[0];
    selectNote(nextNote);
  };

  const confirmDelete = () => {
    if (deleteTarget) deleteNote(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <>
      <BottomModal
        open={open}
        title="备忘录"
        titleExtra={(
          <div className="memo-modal__format-toggle">
            <span className="memo-modal__format-toggle-label">复杂格式</span>
            <PreferenceToggleButton
              checked={complexFormat}
              label="复杂格式"
              onChange={handleComplexFormatChange}
            />
          </div>
        )}
        onClose={onClose}
        width={900}
        className="memo-modal"
      >
        <div className="memo-modal__body">
          <aside className="memo-modal__sidebar" aria-label="备忘录列表">
            <Button
              className="memo-modal__new"
              icon={<PlusIcon />}
              onClick={startNewNote}
            >
              新建备忘录
            </Button>
            <ul className="memo-modal__nav">
              {orderedNotes.map((note) => {
                const active = !creating && note.id === selectedId;
                const updatedAt = memoUpdatedAt(note.updatedAt);
                const preview = memoPreview(note.text);
                return (
                  <li
                    key={note.id}
                    className={`memo-modal__nav-row${active ? ' memo-modal__nav-row--active' : ''}`}
                  >
                    <button
                      type="button"
                      className="memo-modal__nav-item"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => selectNote(note)}
                    >
                      <span className="memo-modal__preview" title={note.text}>
                        {preview}
                      </span>
                      {updatedAt ? <time dateTime={new Date(note.updatedAt).toISOString()}>{updatedAt}</time> : null}
                    </button>
                    <FavoriteButton
                      active={Boolean(note.favorite)}
                      label={`${note.favorite ? '取消收藏' : '收藏'}备忘录：${preview}`}
                      className="memo-modal__nav-favorite"
                      onToggle={() => toggleFavorite(note.id)}
                    />
                    <button
                      type="button"
                      className="memo-modal__nav-delete"
                      aria-label={`删除备忘录：${preview}`}
                      title={`删除备忘录：${preview}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDeleteTarget(note);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
              {notes.length === 0 ? <li className="memo-modal__empty">暂无备忘录</li> : null}
            </ul>
          </aside>

          <section className="memo-modal__workspace" aria-label="备忘录编辑区">
            <div
              className={`memo-modal__editor-shell memo-modal__editor-shell--${complexFormat ? 'complex' : 'simple'}`}
            >
              {complexFormat ? (
                <>
                  <MemoMarkdownToolbar
                    mode={editorMode}
                    activeFormats={activeFormats}
                    recognizeAction={(
                      <MemoRecognizeButton
                        noteText={editorText}
                        disabled={!activeNote || !editorText.trim()}
                        className="memo-modal__mode-button"
                        variant="text"
                      />
                    )}
                    onFormat={handleFormat}
                    onModeChange={handleEditorModeChange}
                  />
                  {editorMode === 'edit' ? (
                    <textarea
                      ref={editorRef}
                      className="memo-modal__editor"
                      aria-label="备忘录内容"
                      placeholder="在此键入以创建新的备忘录…"
                      value={editorText}
                      onChange={handleComplexEditorChange}
                      onKeyDown={handleComplexEditorKeyDown}
                      onSelect={syncEditorSelection}
                    />
                  ) : (
                    <div
                      className="memo-modal__markdown-preview"
                      aria-label="备忘录预览"
                    >
                      {editorText.trim() ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                          {editorText}
                        </ReactMarkdown>
                      ) : (
                        <p className="memo-modal__markdown-empty">暂无内容</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <textarea
                    ref={editorRef}
                    className="memo-modal__editor memo-modal__editor--simple"
                    aria-label="备忘录内容"
                    placeholder="在此键入以创建新的备忘录…"
                    value={editorText}
                    onChange={handleEditorChange}
                    onSelect={syncEditorSelection}
                  />
                  <div className="memo-modal__recognize">
                    <MemoRecognizeButton
                      noteText={editorText}
                      disabled={!activeNote || !editorText.trim()}
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </BottomModal>
      <BottomModal
        open={open && deleteTarget !== null}
        title="删除这条备忘录？"
        onClose={() => setDeleteTarget(null)}
        width={420}
        className="memo-delete-confirm"
        footer={(
          <>
            <Button onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button danger type="primary" onClick={confirmDelete}>删除</Button>
          </>
        )}
      >
        <p className="bottom-modal__message">
          将删除「{deleteTarget ? memoPreview(deleteTarget.text) : ''}」。删除后无法恢复。
        </p>
      </BottomModal>
    </>
  );
}
