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
        loading={loading}
      >
        {!loading ? (
          <ChevronIcon className={`select-chevron${open ? ' select-chevron--open' : ''}`} />
        ) : null}
      </Button>
    </Dropdown>
  );
}
