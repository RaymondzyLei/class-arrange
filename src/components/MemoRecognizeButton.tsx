import { Button, message } from 'antd';
import { useState } from 'react';
import { useSemesterCatalog } from '@/data/SemesterCatalogContext';
import { usePlans } from '@/store/plansContext';
import { extractCourseRefs, type RecognizedRef } from '@/utils/courseRefs';
import MemoRecognizeModal from './MemoRecognizeModal';

interface Props {
  noteText: string;
  disabled?: boolean;
}

export default function MemoRecognizeButton({ noteText, disabled = false }: Props) {
  const { dispatch } = usePlans();
  const { courseMap, groupsByCode } = useSemesterCatalog();
  const [open, setOpen] = useState(false);
  const [refs, setRefs] = useState<RecognizedRef[]>([]);

  const handleRecognize = () => {
    if (disabled) return;
    setRefs(extractCourseRefs(noteText, { courseMap, groupsByCode }));
    setOpen(true);
  };

  const handleImport = (sectionIds: string[]) => {
    if (sectionIds.length === 0) return;
    dispatch({ type: 'createPlan' });
    dispatch({ type: 'addCourses', courseIds: sectionIds });
    setOpen(false);
    message.success(`已导入 ${sectionIds.length} 个课堂到新课表`);
  };

  return (
    <>
      <Button size="small" disabled={disabled} onClick={handleRecognize}>识别课程</Button>
      <MemoRecognizeModal
        open={open}
        refs={refs}
        onClose={() => setOpen(false)}
        onImport={handleImport}
      />
    </>
  );
}
