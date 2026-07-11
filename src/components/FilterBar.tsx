import { Checkbox, Input } from 'antd';
import type { FilterState } from '@/types';
import {
  DEPARTMENT_OPTIONS,
  COURSE_TYPE_OPTIONS,
  SECTION_TYPE_OPTIONS,
  EXAM_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
} from '@/constants/filterOptions';
import SelectWithChevron from './SelectWithChevron';

interface Props {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
  resultCount: number;
}

export default function FilterBar({ filter, setFilter, resultCount }: Props) {
  const update = (patch: Partial<FilterState>) => setFilter({ ...filter, ...patch });

  return (
    <div className="panel-inner filter-bar no-print" data-tour="filters">
      <div className="filter-bar__search" data-tour="course-search">
        <Input
          placeholder={filter.includeTeacher ? '搜索课程名 / 课堂号 / 教师' : '搜索课程名 / 课堂号'}
          value={filter.keyword}
          onChange={(e) => update({ keyword: e.target.value })}
          allowClear
        />
        <Checkbox
          className="filter-bar__teacher-toggle"
          checked={filter.includeTeacher}
          onChange={(event) => update({ includeTeacher: event.target.checked })}
        >
          查询任课老师
        </Checkbox>
        <span className="filter-bar__count">共 {resultCount} 门</span>
      </div>
      <div className="filter-bar__controls">
        <SelectWithChevron
          className="filter-bar__select filter-bar__select--department"
          size="small"
          placeholder="开课单位"
          value={filter.department || undefined}
          onChange={(v) => update({ department: v ?? '' })}
          allowClear
          options={DEPARTMENT_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <SelectWithChevron
          className="filter-bar__select"
          size="small"
          placeholder="课程类型"
          value={filter.courseType || undefined}
          onChange={(v) => update({ courseType: v ?? '' })}
          allowClear
          options={COURSE_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <SelectWithChevron
          className="filter-bar__select"
          size="small"
          placeholder="课堂类型"
          value={filter.sectionType || undefined}
          onChange={(v) => update({ sectionType: v ?? '' })}
          allowClear
          options={SECTION_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <SelectWithChevron
          className="filter-bar__select"
          size="small"
          placeholder="考核方式"
          value={filter.examType || undefined}
          onChange={(v) => update({ examType: v ?? '' })}
          allowClear
          options={EXAM_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
        <SelectWithChevron
          className="filter-bar__select"
          size="small"
          placeholder="授课语言"
          value={filter.language || undefined}
          onChange={(v) => update({ language: v ?? '' })}
          allowClear
          options={LANGUAGE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
      </div>
    </div>
  );
}
