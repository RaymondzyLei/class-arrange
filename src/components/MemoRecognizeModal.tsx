import { Button, Checkbox } from 'antd';
import { useEffect, useState } from 'react';
import BottomModal from './BottomModal';
import type { RecognizedCourseRef, RecognizedRef } from '@/utils/courseRefs';

interface Props {
  open: boolean;
  refs: RecognizedRef[];
  onClose: () => void;
  onImport: (sectionIds: string[]) => void;
}

function allSectionIds(refs: readonly RecognizedRef[]): string[] {
  return refs.flatMap((r) => (r.type === 'course' ? r.sectionIds : [r.sectionId]));
}

export default function MemoRecognizeModal({ open, refs, onClose, onImport }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allSectionIds(refs)));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelected(new Set(allSectionIds(refs)));
    setExpanded(new Set());
  }, [refs]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleCourse = (ref: RecognizedCourseRef) => {
    const allSelected = ref.sectionIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ref.sectionIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const toggleExpand = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const handleImport = () => onImport([...selected]);

  return (
    <BottomModal
      open={open}
      title="识别到的课程"
      onClose={onClose}
      width={560}
      className="memo-recognize-modal"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" disabled={selected.size === 0} onClick={handleImport}>
            导入到新课表
          </Button>
        </>
      }
    >
      <div className="memo-recognize__body">
        {refs.length === 0 ? (
          <p className="memo-recognize__empty">未识别到当前学期的课程号或课堂号</p>
        ) : (
          <ul className="memo-recognize__list">
            {refs.map((ref) =>
              ref.type === 'course' ? (
                <li key={ref.courseCode} className="memo-recognize__group">
                  <div className="memo-recognize__group-head">
                    <Checkbox
                      checked={ref.sectionIds.every((id) => selected.has(id))}
                      onChange={() => toggleCourse(ref)}
                    >
                      {ref.courseName}（{ref.courseCode}）
                    </Checkbox>
                    <button
                      type="button"
                      className="memo-recognize__expand"
                      onClick={() => toggleExpand(ref.courseCode)}
                    >
                      {expanded.has(ref.courseCode)
                        ? '收起'
                        : `展开 ${ref.sectionIds.length} 个班次`}
                    </button>
                  </div>
                  {expanded.has(ref.courseCode) ? (
                    <ul className="memo-recognize__sections">
                      {ref.sectionIds.map((id) => (
                        <li key={id}>
                          <Checkbox checked={selected.has(id)} onChange={() => toggle(id)}>
                            {id}
                          </Checkbox>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ) : (
                <li key={ref.sectionId} className="memo-recognize__item">
                  <Checkbox
                    checked={selected.has(ref.sectionId)}
                    onChange={() => toggle(ref.sectionId)}
                  >
                    {ref.courseName}（{ref.sectionId}）
                  </Checkbox>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </BottomModal>
  );
}
