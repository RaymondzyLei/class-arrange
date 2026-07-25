import { Button } from 'antd';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import BottomModal from './BottomModal';
import { PlusIcon, TrashIcon } from './icons';
import MemoRecognizeButton from './MemoRecognizeButton';
import { useMemos } from '@/memos/MemosContext';
import type { MemoNote } from '@/types';

interface Props {
  open: boolean;
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

export default function MemoModal({ open, onClose }: Props) {
  const { notes, addNote, updateNote, removeNote } = useMemos();
  const initialNote = notes[0] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialNote?.id ?? null);
  const [creating, setCreating] = useState(initialNote === null);
  const [editorText, setEditorText] = useState(initialNote?.text ?? '');
  const [deleteTarget, setDeleteTarget] = useState<MemoNote | null>(null);
  const wasOpenRef = useRef(false);
  const newNoteRequestedRef = useRef(false);
  const pendingNewTextRef = useRef<string | null>(null);

  const activeNote = useMemo(
    () => (creating ? null : notes.find((note) => note.id === selectedId) ?? null),
    [creating, notes, selectedId],
  );

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open) {
      setDeleteTarget(null);
      return;
    }
    if (wasOpen) return;

    const firstNote = notes[0] ?? null;
    setCreating(firstNote === null);
    setSelectedId(firstNote?.id ?? null);
    setEditorText(firstNote?.text ?? '');
    newNoteRequestedRef.current = false;
    pendingNewTextRef.current = null;
    setDeleteTarget(null);
  }, [notes, open]);

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
    if (pendingText !== createdNote.text) {
      updateNote(createdNote.id, pendingText);
    }
  }, [notes, updateNote]);

  const startNewNote = () => {
    newNoteRequestedRef.current = false;
    pendingNewTextRef.current = null;
    setCreating(true);
    setSelectedId(null);
    setEditorText('');
  };

  const selectNote = (note: MemoNote) => {
    newNoteRequestedRef.current = false;
    pendingNewTextRef.current = null;
    setCreating(false);
    setSelectedId(note.id);
    setEditorText(note.text);
  };

  const handleEditorChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
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

  const deleteNote = (note: MemoNote) => {
    const noteIndex = notes.findIndex((candidate) => candidate.id === note.id);
    const remaining = notes.filter((candidate) => candidate.id !== note.id);
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
              {notes.map((note) => {
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
            <div className="memo-modal__editor-shell">
              <textarea
                className="memo-modal__editor"
                aria-label="备忘录内容"
                placeholder="在此键入以创建新的备忘录…"
                value={editorText}
                onChange={handleEditorChange}
              />
              <div className="memo-modal__recognize">
                <MemoRecognizeButton
                  noteText={editorText}
                  disabled={!activeNote || !editorText.trim()}
                />
              </div>
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
