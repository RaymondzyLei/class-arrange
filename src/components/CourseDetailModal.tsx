import { useEffect, useState } from 'react';
import { App, Button, Descriptions, Table, Tag, Typography } from 'antd';
import type { CourseGroup } from '@/types';
import { usePlans } from '@/store/plansContext';
import { formatWeeks, expandWeeks } from '@/utils/weeks';
import { DAY_LABELS } from '@/constants/grid';
import { getIcourseRatingInfo, type IcourseRatingInfo } from '@/utils/icourseRating';
import { formatScheduleCompact } from '@/utils/scheduleFormat';
import BottomModal from './BottomModal';

interface Props {
  group: CourseGroup | null;
  open: boolean;
  onClose: () => void;
}

function RatingLink({ rating }: { rating?: IcourseRatingInfo }) {
  if (!rating) return <>—</>;
  const label = typeof rating.ratingCount === 'number'
    ? `${rating.score}（${rating.ratingCount}人）`
    : rating.score;
  return (
    <a
      className="detail-rating"
      href={rating.url}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}

function firstExpandedWeek(weeks: number[]): number {
  return expandWeeks(weeks)[0] ?? 999;
}

function firstPeriod(periods: number[]): number {
  return periods[0] ?? 999;
}

function sectionLabelForGroup(group: CourseGroup): string {
  if (group.sections.length <= 1) return group.sectionIds[0] ?? group.courseCode;
  return `${group.courseCode}.(${group.sectionIds
    .map((id) => id.slice(id.lastIndexOf('.') + 1))
    .sort()
    .join(',')})`;
}
function formatClassLabels(classes: string[]): string {
  return classes.map((label) => label.replace(/\*+$/, '')).join('，');
}

export default function CourseDetailModal({ group, open, onClose }: Props) {
  const { activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  // 缓存最后一次非 null 的组，保证关闭动画期间内容不消失。
  const [cached, setCached] = useState<CourseGroup | null>(null);
  useEffect(() => {
    if (group) setCached(group);
  }, [group]);
  const display = group ?? cached;

  if (!display) return null;

  const rep = display.sections[0];
  const sectionLabel = sectionLabelForGroup(display);
  const selected = display.sectionIds.every((id) => activePlan?.courseIds.includes(id));
  const singleRating =
    display.sections.length === 1 ? getIcourseRatingInfo(display.sections[0].id) : undefined;
  const sortedSchedule = [...display.schedule].sort((a, b) =>
    firstExpandedWeek(a.weeks) - firstExpandedWeek(b.weeks)
    || a.day - b.day
    || firstPeriod(a.periods) - firstPeriod(b.periods)
    || (a.room || '').localeCompare(b.room || '', 'zh-Hans-CN'),
  );
  const scheduleRows = sortedSchedule.map((s, i) => ({
    key: i,
    weeks: formatWeeks(s.weeks),
    weeksExpanded: expandWeeks(s.weeks).join(', '),
    day: DAY_LABELS[s.day] ?? s.day,
    periods: s.periods.join(', '),
    room: s.room || '—',
  }));

  const sectionRows = [...display.sections]
    .sort((a, b) => {
      const aSlot = a.schedule[0];
      const bSlot = b.schedule[0];
      return (aSlot ? firstExpandedWeek(aSlot.weeks) : 999) - (bSlot ? firstExpandedWeek(bSlot.weeks) : 999)
        || (aSlot?.day ?? 999) - (bSlot?.day ?? 999)
        || firstPeriod(aSlot?.periods ?? []) - firstPeriod(bSlot?.periods ?? [])
        || a.id.localeCompare(b.id);
    })
    .map((s, i) => ({
    key: i,
    id: s.id,
    teacher: s.teacher || '—',
    // section 顶层不存 room；教室只在 schedule slot 上有。
    // 同 section 的所有 slot 通常同教室，取第一个非空即可。
    room: s.schedule.find((sl) => sl.room)?.room || '—',
    capacity: s.capacity,
    enrolled: s.enrolled,
    time: formatScheduleCompact(s.schedule),
    classes: s.classes.length ? formatClassLabels(s.classes) : '—',
    rating: getIcourseRatingInfo(s.id),
  }));

  const toggleSelected = () => {
    if (!activePlan) {
      message.warning('请先新建一个方案');
      return;
    }
    if (selected) {
      dispatch({ type: 'removeCourses', courseIds: display.sectionIds });
      message.success(`已移除「${display.courseName}」`);
      return;
    }
    dispatch({ type: 'addCourses', courseIds: display.sectionIds });
    message.success(`已加入「${display.courseName}」`);
  };

  return (
    <BottomModal
      title={`${display.courseName}${display.sections.length > 1 ? `（${display.sections.length} 个班次）` : ''}`}
      open={open}
      onClose={onClose}
      width={1180}
      actions={(
        <Button
          size="small"
          type={selected ? 'primary' : 'default'}
          danger={selected}
          onClick={toggleSelected}
        >
          {selected ? '移除' : '加入'}
        </Button>
      )}
    >
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="课堂号/班次">{sectionLabel}</Descriptions.Item>
        <Descriptions.Item label="开课单位">{rep?.department.name ?? '—'}（{rep?.department.code ?? ''}）</Descriptions.Item>
        <Descriptions.Item label="授课教师" span={2}>
          {display.teachers.length ? display.teachers.join('、') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="学分 / 学时">{rep?.credits ?? 0} / {rep?.hours ?? 0}</Descriptions.Item>
        <Descriptions.Item label="考核方式">{rep?.examType ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="课程类型">{rep?.courseType ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="授课语言">{rep?.language ?? '—'}</Descriptions.Item>
        {rep?.undergradShared ? (
          <Descriptions.Item label="本研同堂"><Tag color="blue">是</Tag></Descriptions.Item>
        ) : null}
        {singleRating ? (
          <Descriptions.Item label="icourse 评分">
            <RatingLink rating={singleRating} />
          </Descriptions.Item>
        ) : null}
      </Descriptions>

      {display.sections.length > 1 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 16 }}>班次明细</Typography.Title>
          <Table
            className="detail-table detail-section-table"
            size="small"
            dataSource={sectionRows}
            pagination={false}
            tableLayout="auto"
            columns={[
              { title: '课堂号', dataIndex: 'id', width: 110 },
              { title: '教师', dataIndex: 'teacher', width: 120 },
              { title: '时间地点', dataIndex: 'time' },
              { title: '选课/限选', dataIndex: 'capacity', width: 96, render: (_: unknown, r: { enrolled: number; capacity: number }) => `${r.enrolled} / ${r.capacity}` },
              { title: '评分', dataIndex: 'rating', width: 110, render: (v: IcourseRatingInfo | undefined) => <RatingLink rating={v} /> },
              { title: '上课班级', dataIndex: 'classes' },
            ]}
          />
        </>
      )}

      <Typography.Title level={5} style={{ marginTop: 16 }}>时间地点</Typography.Title>
      <Table
        className="detail-table detail-schedule-table"
        size="small"
        dataSource={scheduleRows}
        pagination={false}
        tableLayout="auto"
        columns={[
          { title: '周次', dataIndex: 'weeks', width: 120 },
          { title: '展开周', dataIndex: 'weeksExpanded', render: (v: string) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v}</Typography.Text> },
          { title: '星期', dataIndex: 'day', width: 70 },
          { title: '节次', dataIndex: 'periods', width: 90 },
          { title: '教室', dataIndex: 'room' },
        ]}
      />
    </BottomModal>
  );
}
