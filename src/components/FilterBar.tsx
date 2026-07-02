import { Input, Select, Space } from 'antd';
import type { FilterState } from '@/types';
import {
  DEPARTMENT_OPTIONS,
  COURSE_TYPE_OPTIONS,
  SECTION_TYPE_OPTIONS,
  EXAM_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
} from '@/constants/filterOptions';

interface Props {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
}

export default function FilterBar({ filter, setFilter }: Props) {
  const update = (patch: Partial<FilterState>) => setFilter({ ...filter, ...patch });

  return (
    <div className="panel-inner filter-bar no-print">
      <div className="filter-bar__search">
        <Input.Search
          placeholder="搜索课程名 / 课堂号 / 教师"
          value={filter.keyword}
          onChange={(e) => update({ keyword: e.target.value })}
          allowClear
        />
      </div>
      <Space size={6} wrap>
        <Select
          placeholder="开课单位"
          value={filter.department || undefined}
          onChange={(v) => update({ department: v ?? '' })}
          allowClear
          style={{ width: 150 }}
          options={DEPARTMENT_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <Select
          placeholder="课程类型"
          value={filter.courseType || undefined}
          onChange={(v) => update({ courseType: v ?? '' })}
          allowClear
          style={{ width: 120 }}
          options={COURSE_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <Select
          placeholder="课堂类型"
          value={filter.sectionType || undefined}
          onChange={(v) => update({ sectionType: v ?? '' })}
          allowClear
          style={{ width: 140 }}
          options={SECTION_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <Select
          placeholder="考核方式"
          value={filter.examType || undefined}
          onChange={(v) => update({ examType: v ?? '' })}
          allowClear
          style={{ width: 150 }}
          options={EXAM_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <Select
          placeholder="授课语言"
          value={filter.language || undefined}
          onChange={(v) => update({ language: v ?? '' })}
          allowClear
          style={{ width: 130 }}
          options={LANGUAGE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
      </Space>
    </div>
  );
}