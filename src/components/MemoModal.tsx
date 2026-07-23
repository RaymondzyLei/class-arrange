import { Button } from 'antd';
import { useState } from 'react';
import BottomModal from './BottomModal';
import { useMemos } from '@/memos/MemosContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MemoModal({ open, onClose }: Props) {
  const { notes, addNote, updateNote, removeNote } = useMemos();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    addNote(text);
    setDraft('');
  };

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const commitEdit = () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (text) {
      updateNote(editingId, text);
    } else {
      removeNote(editingId);
    }
    cancelEdit();
  };

  return (
    <BottomModal
      open={open}
      title="备忘录"
      onClose={onClose}
      width={560}
      className="memo-modal"
      footer={<Button type="primary" onClick={onClose}>关闭</Button>}
    >
      <div className="memo-modal__body">
        <div className="memo-modal__compose">
          <textarea
            className="memo-modal__textarea"
            placeholder="记录选课备注…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
          />
          <Button size="small" onClick={handleAdd} disabled={!draft.trim()}>添加</Button>
        </div>
        <ul className="memo-modal__list">
          {notes.map((note) => (
            <li key={note.id} className="memo-modal__item">
              {editingId === note.id ? (
                <div className="memo-modal__edit">
                  <textarea
                    className="memo-modal__textarea"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={2}
                  />
                  <div className="memo-modal__actions">
                    <Button size="small" type="primary" onClick={commitEdit}>保存</Button>
                    <Button size="small" onClick={cancelEdit}>取消</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="memo-modal__text">{note.text}</p>
                  <div className="memo-modal__actions">
                    <Button size="small" onClick={() => startEdit(note.id, note.text)}>编辑</Button>
                    <Button size="small" danger onClick={() => removeNote(note.id)}>删除</Button>
                  </div>
                </>
              )}
            </li>
          ))}
          {notes.length === 0 ? <li className="memo-modal__empty">暂无备忘录</li> : null}
        </ul>
      </div>
    </BottomModal>
  );
}
