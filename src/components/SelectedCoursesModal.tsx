import { App, Button, Empty, Space, Table, Tabs, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { TableProps } from 'antd';
import type { Arrangement, CourseGroup } from '@/types';
import { getAllCourseGroups } from '@/utils/courseGroup';
import { conflictGroupSet, detectConflicts } from '@/utils/conflict';
import { formatScheduleCompact } from '@/utils/scheduleFormat';
import {
  ALL_CURRICULUM_TERMS,
  curriculumOptions,
  filterCurriculumOption,
  getCurriculum,
  getCurriculumTerms,
  isDeferredCurriculumCourse,
} from '@/utils/curriculum';
import type { CurriculumCourse } from '@/data/curricula';
import { usePlans } from '@/store/plansContext';
import BottomModal from './BottomModal';
import SelectWithChevron from './SelectWithChevron';

interface Props {
  open: boolean;
  onClose: () => void;
  appliedGroups: CourseGroup[];
  allSelectedGroups: CourseGroup[];
  selectedIds: Set<string>;
  conflictGroupKeys: Set<string>;
  arrangements: Arrangement[];
  currentArrangementId: string | null;
  selectedCurriculumId: string | null;
  selectedCurriculumTerm: string | null;
  onArrangementChange: (id: string) => void;
  onCurriculumChange: (id: string | null) => void;
  onCurriculumTermChange: (term: string | null) => void;
  onOpenDetail: (groupKey: string) => void;
}

interface GroupRow {
  key: string;
  group: CourseGroup;
  courseName: string;
  sectionLabel: string;
  teachers: string;
  credits: number;
  schedule: string;
  applied: boolean;
  conflict: boolean;
}

interface CurriculumRow {
  key: string;
  course: CurriculumCourse;
  matches: CourseGroup[];
  selected: boolean;
}

function sectionLabelForGroup(group: CourseGroup): string {
  if (group.sections.length <= 1) return group.sectionIds[0] ?? group.courseCode;
  return `${group.courseCode}.(${group.sectionIds
    .map((id) => id.slice(id.lastIndexOf('.') + 1))
    .sort()
    .join(',')})`;
}

function creditsForGroup(group: CourseGroup): number {
  return group.sections[0]?.credits ?? 0;
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dedupeCurriculumCourses(courses: CurriculumCourse[]): CurriculumCourse[] {
  const seen = new Set<string>();
  return courses.filter((course) => {
    const key = `${course.code}::${course.name}::${course.modulePath.join('/')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGroupsByCode(): Map<string, CourseGroup[]> {
  const map = new Map<string, CourseGroup[]>();
  for (const group of getAllCourseGroups()) {
    const current = map.get(group.courseCode);
    if (current) current.push(group);
    else map.set(group.courseCode, [group]);
  }
  return map;
}

function groupIsSelected(group: CourseGroup, selectedIds: Set<string>): boolean {
  return group.sectionIds.every((id) => selectedIds.has(id));
}

function conflictStatusForCandidate(candidate: CourseGroup, currentGroups: CourseGroup[]): {
  conflict: boolean;
  names: string[];
} {
  const comparableGroups = currentGroups.filter((group) => group.courseCode !== candidate.courseCode);
  const conflicts = detectConflicts([...comparableGroups, candidate]);
  const conflictKeys = conflictGroupSet(conflicts);
  if (!conflictKeys.has(candidate.key)) return { conflict: false, names: [] };
  return {
    conflict: true,
    names: comparableGroups
      .filter((group) => conflictKeys.has(group.key))
      .map((group) => group.courseName),
  };
}

function isInteractiveClick(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest([
    'button',
    'a',
    'input',
    'textarea',
    'select',
    '.ant-btn',
    '.ant-checkbox',
    '.ant-checkbox-wrapper',
    '.ant-table-selection-column',
    '.ant-select',
  ].join(',')));
}

export default function SelectedCoursesModal({
  open,
  onClose,
  appliedGroups,
  allSelectedGroups,
  selectedIds,
  conflictGroupKeys,
  arrangements,
  currentArrangementId,
  selectedCurriculumId,
  selectedCurriculumTerm,
  onArrangementChange,
  onCurriculumChange,
  onCurriculumTermChange,
  onOpenDetail,
}: Props) {
  const { state, activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([]);
  const [candidateCourse, setCandidateCourse] = useState<CurriculumCourse | null>(null);
  const [confirmAction, setConfirmAction] = useState<'batchRemove' | 'clearPlan' | null>(null);

  const appliedKeys = useMemo(
    () => new Set(appliedGroups.map((group) => group.key)),
    [appliedGroups],
  );
  const selectedCourseCodes = useMemo(
    () => new Set(allSelectedGroups.map((group) => group.courseCode)),
    [allSelectedGroups],
  );
  const groupsByCode = useMemo(buildGroupsByCode, []);
  const planOptions = useMemo(
    () => state.plans.map((plan) => ({
      value: plan.id,
      label: `${plan.name}（${plan.courseIds.length} 个课堂）`,
    })),
    [state.plans],
  );
  const arrangementOptions = useMemo(
    () => arrangements.map((arrangement, index) => ({
      value: arrangement.id,
      label: `#${index} · ${arrangement.courseCount} 门 · ${arrangement.totalCredits} 学分 · ${
        arrangement.conflictCount === 0 ? '无冲突' : `${arrangement.conflictCount} 冲突`
      }`,
    })),
    [arrangements],
  );

  const selectedCurriculum = getCurriculum(selectedCurriculumId);
  const curriculumTerms = useMemo(() => getCurriculumTerms(selectedCurriculum), [selectedCurriculum]);
  const allTermCurriculumCourses = useMemo(
    () => {
      if (!selectedCurriculum) return [];
      return dedupeCurriculumCourses(
        curriculumTerms.flatMap((term) => selectedCurriculum.terms[term] ?? []),
      );
    },
    [selectedCurriculum, curriculumTerms],
  );
  const termOptions = useMemo(() => {
    if (!selectedCurriculum) return [];
    const allVisibleCount = allTermCurriculumCourses
      .filter((course) => !isDeferredCurriculumCourse(course)).length;
    return [
      {
        value: ALL_CURRICULUM_TERMS,
        label: `显示全部学期（${allVisibleCount} 门）`,
      },
      ...curriculumTerms.map((term) => ({
        value: term,
        label: `${term}（${
          selectedCurriculum.terms[term]?.filter((course) => !isDeferredCurriculumCourse(course)).length ?? 0
        } 门）`,
      })),
    ];
  }, [allTermCurriculumCourses, curriculumTerms, selectedCurriculum]);
  const curriculumCourses = selectedCurriculum && selectedCurriculumTerm
    ? selectedCurriculumTerm === ALL_CURRICULUM_TERMS
      ? allTermCurriculumCourses
      : selectedCurriculum.terms[selectedCurriculumTerm] ?? []
    : [];
  const visibleCurriculumCourses = useMemo(
    () => curriculumCourses.filter((course) => !isDeferredCurriculumCourse(course)),
    [curriculumCourses],
  );
  const deferredCurriculumCourses = useMemo(
    () => {
      if (!selectedCurriculum) return [];
      const courses = Object.values(selectedCurriculum.terms).flat().filter(isDeferredCurriculumCourse);
      const seen = new Set<string>();
      return courses.filter((course) => {
        const key = `${course.code}::${course.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    [selectedCurriculum],
  );
  const deferredCourseSummary = deferredCurriculumCourses
    .map((course) => `${course.name}（${course.code}）`)
    .join('、');

  const makeRows = (groups: CourseGroup[]): GroupRow[] => groups.map((group) => ({
    key: group.key,
    group,
    courseName: group.courseName,
    sectionLabel: sectionLabelForGroup(group),
    teachers: group.teachers.join('、') || '教师未定',
    credits: creditsForGroup(group),
    schedule: formatScheduleCompact(group.schedule),
    applied: appliedKeys.has(group.key),
    conflict: conflictGroupKeys.has(group.key),
  }));

  const currentRows = useMemo(() => makeRows(appliedGroups), [appliedGroups, appliedKeys, conflictGroupKeys]);
  const allRows = useMemo(() => makeRows(allSelectedGroups), [allSelectedGroups, appliedKeys, conflictGroupKeys]);
  const curriculumRows = useMemo<CurriculumRow[]>(
    () => visibleCurriculumCourses.map((course, index) => ({
      key: `${course.code}-${index}`,
      course,
      matches: groupsByCode.get(course.code) ?? [],
      selected: selectedCourseCodes.has(course.code),
    })),
    [visibleCurriculumCourses, groupsByCode, selectedCourseCodes],
  );

  useEffect(() => {
    const validKeys = new Set(allRows.map((row) => row.key));
    setSelectedGroupKeys((keys) => keys.filter((key) => validKeys.has(key)));
  }, [allRows]);

  useEffect(() => {
    if (!open) {
      setCandidateCourse(null);
      setConfirmAction(null);
    }
  }, [open]);

  const removeGroup = (group: CourseGroup) => {
    dispatch({ type: 'removeCourses', courseIds: group.sectionIds });
    message.success(`已移除「${group.courseName}」`);
  };

  const removeCourse = (courseCode: string, courseName: string) => {
    const ids = dedupe(
      allSelectedGroups
        .filter((group) => group.courseCode === courseCode)
        .flatMap((group) => group.sectionIds),
    );
    if (ids.length === 0) return;
    dispatch({ type: 'removeCourses', courseIds: ids });
    message.success(`已移除课程「${courseName}」`);
  };

  const removeSelectedGroups = () => {
    const selectedKeySet = new Set(selectedGroupKeys);
    const ids = dedupe(
      allSelectedGroups
        .filter((group) => selectedKeySet.has(group.key))
        .flatMap((group) => group.sectionIds),
    );
    if (ids.length === 0) return;
    dispatch({ type: 'removeCourses', courseIds: ids });
    setSelectedGroupKeys([]);
    setConfirmAction(null);
    message.success(`已批量移除 ${ids.length} 个课堂`);
  };

  const clearActivePlan = () => {
    if (allSelectedGroups.length === 0) return;
    dispatch({ type: 'clearActive' });
    setSelectedGroupKeys([]);
    setConfirmAction(null);
    message.success('已清空当前方案');
  };

  const switchPlan = (id: string) => {
    if (id === activePlan?.id) return;
    const plan = state.plans.find((item) => item.id === id);
    dispatch({ type: 'switchPlan', id });
    if (plan) message.success(`已切换到「${plan.name}」`);
  };

  const addGroup = (group: CourseGroup) => {
    if (!activePlan) {
      message.warning('请先新建一个方案');
      return;
    }
    if (groupIsSelected(group, selectedIds)) {
      message.info('该时间组已在当前方案中');
      return;
    }
    dispatch({ type: 'addCourses', courseIds: group.sectionIds });
    message.success(`已加入「${group.courseName}」`);
  };

  const openDetail = (group: CourseGroup) => {
    onOpenDetail(group.key);
  };

  const openCurriculumRow = (row: CurriculumRow) => {
    if (row.matches.length === 1) {
      openDetail(row.matches[0]);
      return;
    }
    if (row.matches.length > 1) {
      setCandidateCourse(row.course);
    }
  };

  const groupColumns: TableProps<GroupRow>['columns'] = [
    { title: '课程名', dataIndex: 'courseName', width: 170 },
    { title: '课堂号/班次', dataIndex: 'sectionLabel', width: 130 },
    { title: '教师', dataIndex: 'teachers', width: 150 },
    { title: '学分', dataIndex: 'credits', width: 70 },
    { title: '时间地点', dataIndex: 'schedule' },
    {
      title: '状态',
      width: 92,
      render: (_, row) => {
        if (!row.applied) return <Tag>未应用</Tag>;
        return row.conflict ? <Tag color="orange">冲突</Tag> : <Tag color="green">无冲突</Tag>;
      },
    },
    {
      title: '操作',
      width: 180,
      render: (_, row) => (
        <Space size={4} wrap onClick={(event) => event.stopPropagation()}>
          <Button size="small" danger onClick={() => removeGroup(row.group)}>移除此时间组</Button>
          <Button
            size="small"
            danger
            onClick={() => removeCourse(row.group.courseCode, row.group.courseName)}
          >
            移除此课程
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection: TableProps<GroupRow>['rowSelection'] = {
    selectedRowKeys: selectedGroupKeys,
    onChange: (keys) => setSelectedGroupKeys(keys.map(String)),
  };

  const curriculumColumns: TableProps<CurriculumRow>['columns'] = [
    {
      title: '课程',
      width: 220,
      render: (_, row) => (
        <div className="selected-course-main">
          <span className="selected-course-code">{row.course.code}</span>
          <span>{row.course.name}</span>
        </div>
      ),
    },
    { title: '学分', width: 70, render: (_, row) => row.course.credits },
    {
      title: '类型',
      width: 80,
      render: (_, row) => (row.course.compulsory ? <Tag color="blue">必修</Tag> : <Tag>选修</Tag>),
    },
    {
      title: '模块',
      dataIndex: ['course', 'modulePath'],
      render: (_, row) => row.course.modulePath.join(' / '),
    },
    {
      title: '开课状态',
      width: 160,
      render: (_, row) => {
        if (row.matches.length === 0) return <Tag>本学期未开</Tag>;
        if (row.matches.length === 1) return formatScheduleCompact(row.matches[0].schedule);
        return <Tag color="blue">{row.matches.length} 个时间组</Tag>;
      },
    },
    {
      title: '已选',
      width: 80,
      render: (_, row) => (row.selected ? <Tag color="green">已选</Tag> : <Tag>未选</Tag>),
    },
    {
      title: '操作',
      width: 120,
      render: (_, row) => {
        if (row.matches.length === 0) {
          return (
            <Button size="small" disabled onClick={(event) => event.stopPropagation()}>
              加入
            </Button>
          );
        }
        if (row.matches.length === 1) {
          const [group] = row.matches;
          const selected = groupIsSelected(group, selectedIds);
          return (
            <Button
              size="small"
              type={selected ? 'default' : 'primary'}
              danger={selected}
              onClick={(event) => {
                event.stopPropagation();
                if (selected) removeGroup(group);
                else addGroup(group);
              }}
            >
              {selected ? '移除' : '加入'}
            </Button>
          );
        }
        return (
          <Button
            size="small"
            type="primary"
            onClick={(event) => {
              event.stopPropagation();
              setCandidateCourse(row.course);
            }}
          >
            选择时间组
          </Button>
        );
      },
    },
  ];

  const candidateGroups = candidateCourse ? groupsByCode.get(candidateCourse.code) ?? [] : [];
  const candidateColumns: TableProps<CourseGroup>['columns'] = [
    { title: '课堂号/班次', width: 130, render: (_, group) => sectionLabelForGroup(group) },
    { title: '教师', width: 160, render: (_, group) => group.teachers.join('、') || '教师未定' },
    { title: '学分', width: 70, render: (_, group) => creditsForGroup(group) },
    { title: '时间地点', render: (_, group) => formatScheduleCompact(group.schedule) },
    {
      title: '状态',
      width: 100,
      render: (_, group) => {
        const status = conflictStatusForCandidate(group, appliedGroups);
        return status.conflict ? (
          <Tag color="orange" title={status.names.join('、')}>
            冲突
          </Tag>
        ) : (
          <Tag color="green">无冲突</Tag>
        );
      },
    },
    {
      title: '操作',
      width: 90,
      render: (_, group) => (
        <Space size={4} onClick={(event) => event.stopPropagation()}>
          {groupIsSelected(group, selectedIds) ? (
            <Button size="small" danger onClick={() => removeGroup(group)}>
              移除
            </Button>
          ) : (
          <Button
            size="small"
            type="primary"
            onClick={() => addGroup(group)}
          >
            加入
          </Button>
          )}
        </Space>
      ),
    },
  ];

  const renderGroupTable = (rows: GroupRow[], selectable: boolean) => (
    <Table<GroupRow>
      className="detail-table selected-courses-table"
      size="small"
      rowKey="key"
      dataSource={rows}
      columns={groupColumns}
      rowSelection={selectable ? rowSelection : undefined}
      pagination={false}
      tableLayout="auto"
      onRow={(row) => ({
        className: 'selected-courses-row--clickable',
        onClick: (event) => {
          if (isInteractiveClick(event.target)) return;
          openDetail(row.group);
        },
      })}
    />
  );

  const renderGroupCards = (rows: GroupRow[]) => (
    <div className="selected-courses-mobile-list">
      {rows.map((row) => (
        <article
          className="selected-courses-card"
          key={row.key}
          role="button"
          tabIndex={0}
          onClick={() => openDetail(row.group)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') openDetail(row.group);
          }}
        >
          <div className="selected-courses-card__head">
            <span className="selected-courses-card__title">{row.courseName}</span>
            {row.applied ? (
              row.conflict ? <Tag color="orange">冲突</Tag> : <Tag color="green">无冲突</Tag>
            ) : (
              <Tag>未应用</Tag>
            )}
          </div>
          <div className="selected-courses-card__meta">
            <span>{row.sectionLabel}</span>
            <span>{row.credits} 学分</span>
          </div>
          <div className="selected-courses-card__line">{row.teachers}</div>
          <div className="selected-courses-card__schedule">{row.schedule || '时间地点待定'}</div>
          <div className="selected-courses-card__actions" onClick={(event) => event.stopPropagation()}>
            <Button size="small" danger onClick={() => removeGroup(row.group)}>移除此时间组</Button>
            <Button size="small" danger onClick={() => removeCourse(row.group.courseCode, row.group.courseName)}>
              移除此课程
            </Button>
          </div>
        </article>
      ))}
    </div>
  );

  const renderCurriculumCards = (rows: CurriculumRow[]) => (
    <div className="selected-courses-mobile-list">
      {rows.map((row) => (
        <article
          className={`selected-courses-card${row.matches.length > 0 ? ' selected-courses-card--clickable' : ''}`}
          key={row.key}
          role={row.matches.length > 0 ? 'button' : undefined}
          tabIndex={row.matches.length > 0 ? 0 : undefined}
          onClick={() => openCurriculumRow(row)}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && row.matches.length > 0) openCurriculumRow(row);
          }}
        >
          <div className="selected-courses-card__head">
            <span className="selected-courses-card__title">{row.course.name}</span>
            <span className="selected-course-code">{row.course.code}</span>
          </div>
          <div className="selected-courses-card__meta">
            <span>{row.course.credits} 学分</span>
            <span>{row.course.compulsory ? '必修' : '选修'}</span>
            <span>{row.selected ? '已选' : '未选'}</span>
          </div>
          <div className="selected-courses-card__line">{row.course.modulePath.join(' / ')}</div>
          <div className="selected-courses-card__schedule">
            {row.matches.length === 0
              ? '本学期未开'
              : row.matches.length === 1
                ? formatScheduleCompact(row.matches[0].schedule)
                : `${row.matches.length} 个时间组`}
          </div>
          <div className="selected-courses-card__actions" onClick={(event) => event.stopPropagation()}>
            {row.matches.length === 0 ? (
              <Button size="small" disabled>加入</Button>
            ) : row.matches.length === 1 ? (
              groupIsSelected(row.matches[0], selectedIds) ? (
                <Button size="small" danger onClick={() => removeGroup(row.matches[0])}>移除</Button>
              ) : (
                <Button size="small" type="primary" onClick={() => addGroup(row.matches[0])}>加入</Button>
              )
            ) : (
              <Button size="small" type="primary" onClick={() => setCandidateCourse(row.course)}>选择时间组</Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );

  const renderCandidateCards = (groups: CourseGroup[]) => (
    <div className="selected-courses-mobile-list">
      {groups.map((group) => {
        const status = conflictStatusForCandidate(group, appliedGroups);
        const selected = groupIsSelected(group, selectedIds);
        return (
          <article
            className="selected-courses-card selected-courses-card--clickable"
            key={group.key}
            role="button"
            tabIndex={0}
            onClick={() => openDetail(group)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') openDetail(group);
            }}
          >
            <div className="selected-courses-card__head">
              <span className="selected-courses-card__title">{sectionLabelForGroup(group)}</span>
              {status.conflict ? <Tag color="orange">冲突</Tag> : <Tag color="green">无冲突</Tag>}
            </div>
            <div className="selected-courses-card__meta">
              <span>{creditsForGroup(group)} 学分</span>
              <span>{group.teachers.join('、') || '教师未定'}</span>
            </div>
            <div className="selected-courses-card__schedule">{formatScheduleCompact(group.schedule)}</div>
            <div className="selected-courses-card__actions" onClick={(event) => event.stopPropagation()}>
              {selected ? (
                <Button size="small" danger onClick={() => removeGroup(group)}>移除</Button>
              ) : (
                <Button size="small" type="primary" onClick={() => addGroup(group)}>加入</Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <BottomModal open={open} title="已选课程管理" onClose={onClose} width={1180}>
        <div className="selected-courses-switcher">
          <label className="selected-courses-switcher__field">
            <span className="selected-courses-switcher__label">我的方案</span>
            <SelectWithChevron
              className="selected-courses-plan-select"
              value={activePlan?.id}
              placeholder="选择方案"
              options={planOptions}
              disabled={planOptions.length === 0}
              onChange={(value) => switchPlan(String(value))}
            />
          </label>
          <label className="selected-courses-switcher__field">
            <span className="selected-courses-switcher__label">排课方案</span>
            <SelectWithChevron
              className="selected-courses-arrangement-select"
              value={currentArrangementId ?? undefined}
              placeholder={arrangementOptions.length ? '选择排课方案' : '暂无排课方案'}
              options={arrangementOptions}
              disabled={arrangementOptions.length === 0}
              popupMatchSelectWidth={360}
              onChange={(value) => onArrangementChange(String(value))}
            />
          </label>
        </div>
        <Tabs
          className="selected-courses-tabs"
          items={[
            {
              key: 'current',
              label: '当前排课',
              children: currentRows.length ? (
                <>
                  {renderGroupTable(currentRows, false)}
                  {renderGroupCards(currentRows)}
                </>
              ) : <Empty description="当前排课为空" />,
            },
            {
              key: 'all',
              label: '全部已选',
              children: (
                <div className="selected-courses-section">
                  <div className="selected-courses-toolbar">
                    <Space size={6} wrap>
                      <Button
                        size="small"
                        danger
                        disabled={selectedGroupKeys.length === 0}
                        onClick={() => setConfirmAction('batchRemove')}
                      >
                        批量移除
                      </Button>
                      <Button
                        size="small"
                        danger
                        disabled={allRows.length === 0}
                        onClick={() => setConfirmAction('clearPlan')}
                      >
                        清空方案
                      </Button>
                    </Space>
                  </div>
                  {allRows.length ? (
                    <>
                      {renderGroupTable(allRows, true)}
                      {renderGroupCards(allRows)}
                    </>
                  ) : <Empty description="当前方案暂无已选课程" />}
                </div>
              ),
            },
            {
              key: 'curriculum',
              label: '培养方案内课程',
              children: (
                <div className="selected-courses-section">
                  <div className="selected-courses-toolbar selected-courses-toolbar--filters">
                    <SelectWithChevron
                      className="selected-courses-curriculum-select"
                      showSearch
                      allowClear
                      placeholder="选择或搜索培养方案"
                      value={selectedCurriculumId ?? undefined}
                      options={curriculumOptions}
                      filterOption={filterCurriculumOption}
                      optionFilterProp="label"
                      popupClassName="curriculum-select-dropdown"
                      popupMatchSelectWidth={520}
                      onChange={(value) => onCurriculumChange(typeof value === 'string' ? value : null)}
                    />
                    <SelectWithChevron
                      className="selected-courses-term-select"
                      placeholder="选择学期"
                      value={selectedCurriculumTerm ?? undefined}
                      options={termOptions}
                      disabled={!selectedCurriculum}
                      onChange={(value) => onCurriculumTermChange(typeof value === 'string' ? value : null)}
                    />
                  </div>
                  {deferredCurriculumCourses.length > 0 ? (
                    <div className="selected-courses-deferred">
                      <Tag>暂不展示</Tag>
                      <span>
                        {deferredCourseSummary}
                        暂不进入培养方案课程表（{deferredCurriculumCourses.length} 门）。体育课程未在此处展示。
                      </span>
                    </div>
                  ) : null}
                  {selectedCurriculum && selectedCurriculumTerm ? (
                    <>
                      <Table<CurriculumRow>
                        className="detail-table selected-courses-table"
                        size="small"
                        rowKey="key"
                        dataSource={curriculumRows}
                        columns={curriculumColumns}
                        pagination={false}
                        tableLayout="auto"
                        onRow={(row) => ({
                          className: row.matches.length > 0 ? 'selected-courses-row--clickable' : '',
                          onClick: (event) => {
                            if (isInteractiveClick(event.target)) return;
                            openCurriculumRow(row);
                          },
                        })}
                      />
                      {renderCurriculumCards(curriculumRows)}
                    </>
                  ) : (
                    <Empty description="请选择培养方案和学期" />
                  )}
                </div>
              ),
            },
          ]}
        />
      </BottomModal>

      <BottomModal
        open={confirmAction !== null}
        title={confirmAction === 'batchRemove' ? '确认批量移除？' : '确认清空方案？'}
        onClose={() => setConfirmAction(null)}
        width={420}
        footer={(
          <>
            <Button onClick={() => setConfirmAction(null)}>取消</Button>
            <Button
              danger
              type="primary"
              onClick={confirmAction === 'batchRemove' ? removeSelectedGroups : clearActivePlan}
            >
              {confirmAction === 'batchRemove' ? '批量移除' : '清空方案'}
            </Button>
          </>
        )}
      >
        <p className="bottom-modal__message">
          {confirmAction === 'batchRemove'
            ? `将移除已勾选的 ${selectedGroupKeys.length} 个时间组，此操作会同步更新当前方案和课表。`
            : `将清空当前方案中的 ${allRows.length} 个已选时间组，此操作不可直接撤销。`}
        </p>
      </BottomModal>

      <BottomModal
        open={!!candidateCourse}
        title={candidateCourse ? `选择时间组：${candidateCourse.name}` : '选择时间组'}
        onClose={() => setCandidateCourse(null)}
        width={900}
      >
        <Table<CourseGroup>
          className="detail-table selected-courses-table"
          size="small"
          rowKey="key"
          dataSource={candidateGroups}
          columns={candidateColumns}
          pagination={false}
          tableLayout="auto"
          onRow={(group) => ({
            className: 'selected-courses-row--clickable',
            onClick: (event) => {
              if (isInteractiveClick(event.target)) return;
              openDetail(group);
            },
          })}
        />
        {renderCandidateCards(candidateGroups)}
      </BottomModal>
    </>
  );
}
