import { useEffect, useState } from 'react';
import { Descriptions, Modal, Table, Tag, Typography } from 'antd';
import type { CourseSection } from '@/types';
import { formatWeeks, expandWeeks } from '@/utils/weeks';
import { DAY_LABELS } from '@/constants/grid';

interface Props {
  course: CourseSection | null;
  open: boolean;
  onClose: () => void;
}

export default function CourseDetailModal({ course, open, onClose }: Props) {
  // 缓存最后一次非 null 的课程，保证 Modal 关闭动画期间内容不消失
  const [cached, setCached] = useState<CourseSection | null>(null);
  useEffect(() => {
    if (course) setCached(course);
  }, [course]);
  const display = course ?? cached;

  if (!display) return null;

  const scheduleRows = display.schedule.map((s, i) => ({
    key: i,
    weeks: formatWeeks(s.weeks),
    weeksExpanded: expandWeeks(s.weeks).join(', '),
    day: DAY_LABELS[s.day] ?? s.day,
    periods: s.periods.join(', '),
    room: s.room || '—',
  }));

  return (
    <Modal
      title={display.courseName}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="课堂号">{display.id}</Descriptions.Item>
        <Descriptions.Item label="开课单位">{display.department.name}（{display.department.code}）</Descriptions.Item>
        <Descriptions.Item label="授课教师">{display.teacher || '—'}</Descriptions.Item>
        <Descriptions.Item label="学分 / 学时">{display.credits} / {display.hours}</Descriptions.Item>
        <Descriptions.Item label="学历层次">{display.level}</Descriptions.Item>
        <Descriptions.Item label="课堂类型">{display.sectionType}</Descriptions.Item>
        <Descriptions.Item label="课程类型">{display.courseType}</Descriptions.Item>
        <Descriptions.Item label="课程范畴分类">{display.category || '—'}</Descriptions.Item>
        <Descriptions.Item label="授课语言">{display.language}</Descriptions.Item>
        <Descriptions.Item label="考核方式">{display.examType}</Descriptions.Item>
        <Descriptions.Item label="本研同堂">
          {display.undergradShared ? <Tag color="blue">是</Tag> : '否'}
        </Descriptions.Item>
        <Descriptions.Item label="选课 / 限选">{display.enrolled} / {display.capacity}</Descriptions.Item>
        <Descriptions.Item label="上课班级" span={2}>
          {display.classes.length ? display.classes.join('，') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="原始时间地点" span={2}>
          <Typography.Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {display.rawSchedule || '—'}
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>

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
