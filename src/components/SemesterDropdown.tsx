import { useState } from 'react';
import { Button, Dropdown } from 'antd';
import type { SemesterManifestEntry } from '@/types';
import { ChevronIcon } from './icons';

interface Props {
  semesters: SemesterManifestEntry[];
  semesterKey: string;
  loading: boolean;
  onSelect: (semesterKey: string) => void | Promise<void>;
}

export default function SemesterDropdown({
  semesters,
  semesterKey,
  loading,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const currentSemesterName = semesters.find((semester) => semester.key === semesterKey)?.name
    ?? semesterKey;

  return (
    <Dropdown
      menu={{
        items: semesters.map((semester) => ({ key: semester.key, label: semester.name })),
        selectedKeys: [semesterKey],
        onClick: ({ key }) => {
          setOpen(false);
          if (key !== semesterKey) void onSelect(key);
        },
      }}
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      disabled={loading}
    >
      <Button
        type="text"
        className="course-table__semester-toggle"
        aria-label="选择学期"
        aria-expanded={open}
        aria-busy={loading}
        disabled={loading}
        iconPlacement="end"
        icon={<ChevronIcon className={`select-chevron${open ? ' select-chevron--open' : ''}`} />}
      >
        <span className="course-table__term-name">{currentSemesterName}</span>
      </Button>
    </Dropdown>
  );
}
