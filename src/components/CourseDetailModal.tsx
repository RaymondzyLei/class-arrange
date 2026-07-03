import { useEffect, useState } from 'react';
import { Descriptions, Modal, Table, Tag, Typography } from 'antd';
import type { CourseGroup } from '@/types';
import { formatWeeks, expandWeeks } from '@/utils/weeks';
import { DAY_LABELS } from '@/constants/grid';

interface Props {
  group: CourseGroup | null;
  open: boolean;
  onClose: () => void;
}

export default function CourseDetailModal({ group, open, onClose }: Props) {
  // 缓存最后一次非 null 的组，保证 Modal 关闭动画期间内容不消失
  const [cached, setCached] = useState<CourseGroup | null>(null);
  useEffect(() => {
    if (group) setCached(group);
  }, [group]);
  const display = group ?? cached;

  if (!display) return null;

  const rep = display.sections[0];
  const scheduleRows = display.schedule.map((s, i) => ({
    key: i,
    weeks: formatWeeks(s.weeks),
    weeksExpanded: expandWeeks(s.weeks).join(', '),
    day: DAY_LABELS[s.day] ?? s.day,
    periods: s.periods.join(', '),
    room: s.room || '—',
  }));

  const sectionRows = display.sections.map((s, i) => ({
    key: i,
    id: s.id,
    teacher: s.teacher || '—',
    capacity: s.capacity,
    enrolled: s.enrolled,
    classes: s.classes.length ? s.classes.join('，') : '—',
  }));

  return (
    <Modal
      title={`${display.courseName}${display.sections.length > 1 ? `（${display.sections.length} 个班次）` : ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="课程号">{display.courseCode}</Descriptions.Item>
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
      </Descriptions>

      {display.sections.length > 1 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 16 }}>班次明细</Typography.Title>
          <Table
            size="small"
            dataSource={sectionRows}
            pagination={false}
            columns={[
              { title: '课堂号', dataIndex: 'id', width: 110 },
              { title: '教师', dataIndex: 'teacher', width: 100 },
              { title: '选课/限选', dataIndex: 'capacity', width: 100, render: (_: unknown, r: { enrolled: number; capacity: number }) => `${r.enrolled} / ${r.capacity}` },
              { title: '上课班级', dataIndex: 'classes' },
            ]}
          />
        </>
      )}

      <Typography.Title level={5} style={{ marginTop: 16 }}>结构化时间地点</Typography.Title>
      <Table
        size="small"
        dataSource={scheduleRows}
        pagination={false}
        columns={[
          { title: '周次', dataIndex: 'weeks', width: 120 },
          { title: '展开周', dataIndex: 'weeksExpanded', render: (v: string) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v}</Typography.Text> },
          { title: '星期', dataIndex: 'day', width: 70 },
          { title: '节次', dataIndex: 'periods', width: 90 },
          { title: '教室', dataIndex: 'room' },
        ]}
      />
    </Modal>
  );
}
