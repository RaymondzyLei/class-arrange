import { useEffect, useId, useRef, useState } from 'react';
import { App, Button, Descriptions, Space, Table, Typography } from 'antd';
import type { CourseDetail, CourseGroup } from '@/types';
import { usePlans } from '@/store/plansContext';
import {
  conflictingCourseNamesForSelection,
  idsForCourse,
  idsForGroup,
} from '@/utils/courseSelection';
import { formatWeeks, expandWeeks } from '@/utils/weeks';
import { DAY_LABELS } from '@/constants/grid';
import { getIcourseRatingInfo, type IcourseRatingInfo } from '@/utils/icourseRating';
import {
  formatScheduleCompact,
  formatScheduleSlotTime,
} from '@/utils/scheduleFormat';
import { hasExactScheduleTime } from '@/utils/scheduleTime';
import { formatSectionTeacher, formatTeacherList } from '@/utils/teachers';
import { formatCourseMaterialDisplay } from '@/utils/courseDetails';
import BottomModal from './BottomModal';
import CourseDescriptionPanel, { CourseDescriptionToggle } from './CourseDescriptionPanel';

interface Props {
  group: CourseGroup | null;
  detail?: CourseDetail;
  open: boolean;
  onClose: () => void;
  allSelectedGroups: CourseGroup[];
  groupsByCode: ReadonlyMap<string, CourseGroup[]>;
}

interface ScheduleRow {
  key: number;
  weeks: string;
  weeksExpanded: string;
  day: string | number;
  time: string;
  exactTime: boolean;
  room: string;
}

interface SectionRow {
  key: number;
  id: string;
  teacher: string;
  room: string;
  capacity: number;
  enrolled: number;
  time: string;
  classes: string;
  rating?: IcourseRatingInfo;
}

interface TimeGroupRow {
  key: string;
  label: string;
  sections: string;
  teachers: string;
  schedule: string;
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

export default function CourseDetailModal({
  group,
  detail,
  open,
  onClose,
  allSelectedGroups,
  groupsByCode,
}: Props) {
  const { activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  // 缓存最后一次非 null 的组，保证关闭动画期间内容不消失。
  const [cached, setCached] = useState<CourseGroup | null>(null);
  const [cachedDetail, setCachedDetail] = useState<CourseDetail | undefined>(undefined);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const descriptionPanelId = useId();
  const modalBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!group) return;
    setCached(group);
    setCachedDetail(detail);
    setDescriptionOpen(false);
  }, [group, detail]);
  const display = group ?? cached;
  const displayDetail = group ? detail : cachedDetail;

  const handleDescriptionOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      modalBodyRef.current?.scrollTo({ top: 0 });
    }
    setDescriptionOpen(nextOpen);
  };

  if (!display) return null;

  const mergedTimeGroups = display.timeGroups;
  const rep = display.sections[0];
  const examType = displayDetail?.examType.trim() || rep?.examType.trim() || '—';
  const grading = displayDetail?.grading.trim() || rep?.grading.trim() || '—';
  const materialDisplay = formatCourseMaterialDisplay(displayDetail);
  const sectionLabel = sectionLabelForGroup(display);
  const groupIds = idsForGroup(display);
  const courseIds = idsForCourse(display.courseCode, groupsByCode);
  const groupSelected = groupIds.every((id) => activePlan?.courseIds.includes(id));
  const courseSelected = courseIds.length > 0
    && courseIds.every((id) => activePlan?.courseIds.includes(id));
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
    time: formatScheduleSlotTime(s),
    exactTime: hasExactScheduleTime(s),
    room: s.room || '—',
  } satisfies ScheduleRow));

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
    teacher: formatSectionTeacher(s.teacher, '—'),
    // section 顶层不存 room；教室只在 schedule slot 上有。
    // 同 section 的所有 slot 通常同教室，取第一个非空即可。
    room: s.schedule.find((sl) => sl.room)?.room || '—',
    capacity: s.capacity,
    enrolled: s.enrolled,
    time: formatScheduleCompact(s.schedule),
    classes: s.classes.length ? formatClassLabels(s.classes) : '—',
    rating: getIcourseRatingInfo(s.id),
  } satisfies SectionRow));
  const timeGroupRows = (mergedTimeGroups ?? []).map((timeGroup, index) => ({
    key: timeGroup.key,
    label: `时间组 ${index + 1}`,
    sections: sectionLabelForGroup(timeGroup),
    teachers: formatTeacherList(timeGroup.teachers, '—'),
    schedule: formatScheduleCompact(timeGroup.schedule),
  } satisfies TimeGroupRow));

  const toggleSelected = (scope: 'group' | 'course') => {
    if (!activePlan) {
      message.warning('请先新建一个方案');
      return;
    }
    const ids = scope === 'group' ? groupIds : courseIds;
    if (ids.length === 0) return;
    const selected = ids.every((id) => activePlan.courseIds.includes(id));
    if (selected) {
      dispatch({ type: 'removeCourses', courseIds: ids });
      message.success(scope === 'group'
        ? `已移除「${display.courseName}」的此时间组`
        : `已移除「${display.courseName}」的全部时间组`);
      return;
    }
    const targetGroups = scope === 'group'
      ? [display]
      : groupsByCode.get(display.courseCode) ?? [];
    const conflictNames = conflictingCourseNamesForSelection(targetGroups, allSelectedGroups);
    dispatch({ type: 'addCourses', courseIds: ids });
    if (conflictNames.length > 0) {
      const scopeLabel = scope === 'group' ? '此时间组' : '部分时间组';
      message.warning(
        `「${display.courseName}」的${scopeLabel}与已选课程存在时间冲突：${conflictNames.slice(0, 3).join('、')}（仍已选择）`,
      );
      return;
    }
    message.success(scope === 'group'
      ? `已选择「${display.courseName}」的此时间组`
      : `已选择「${display.courseName}」的全部时间组`);
  };

  return (
    <BottomModal
      className="course-detail-modal"
      title={`${display.courseName}${display.sections.length > 1 ? `（${display.sections.length} 个班次）` : ''}`}
      titleExtra={(
        <CourseDescriptionToggle
          panelId={descriptionPanelId}
          open={descriptionOpen}
          onOpenChange={handleDescriptionOpenChange}
        />
      )}
      open={open}
      onClose={onClose}
      width={1180}
      bodyRef={modalBodyRef}
      actions={(
        <Space size={4} wrap className="course-selection-actions">
          {!mergedTimeGroups ? (
            <Button
              size="small"
              type={groupSelected ? 'default' : 'primary'}
              danger={groupSelected}
              aria-label={`${groupSelected ? '移除此时间组' : '选择此时间组'}：${display.courseName}`}
              onClick={() => toggleSelected('group')}
            >
              {groupSelected ? '移除此时间组' : '选择此时间组'}
            </Button>
          ) : null}
          <Button
            size="small"
            type={courseSelected ? 'default' : 'primary'}
            danger={courseSelected}
            aria-label={`${courseSelected ? '移除全部时间组' : '选择全部时间组'}：${display.courseName}`}
            onClick={() => toggleSelected('course')}
          >
            {courseSelected ? '移除全部时间组' : '选择全部时间组'}
          </Button>
        </Space>
      )}
    >
      <CourseDescriptionPanel
        detail={displayDetail}
        panelId={descriptionPanelId}
        open={descriptionOpen}
      />
      <div className="course-detail-desktop">
        <Descriptions className="course-detail-overview" size="small" column={3} bordered>
          <Descriptions.Item label="课堂号/班次">{sectionLabel}</Descriptions.Item>
          <Descriptions.Item label="开课单位" span={2}>{rep?.department.name ?? '—'}（{rep?.department.code ?? ''}）</Descriptions.Item>
          <Descriptions.Item label="授课教师" span={3}>
            {formatTeacherList(display.teachers, '—')}
          </Descriptions.Item>
          <Descriptions.Item label="学分 / 学时">{rep?.credits ?? 0} / {rep?.hours ?? 0}</Descriptions.Item>
          <Descriptions.Item label="课程类型">{rep?.courseType || '—'}</Descriptions.Item>
          <Descriptions.Item label="授课语言">{rep?.language || '—'}</Descriptions.Item>
          <Descriptions.Item label="考核方式">{examType}</Descriptions.Item>
          <Descriptions.Item label="评分制">{grading}</Descriptions.Item>
          {rep?.undergradShared ? (
            <Descriptions.Item label="本研同堂">是</Descriptions.Item>
          ) : null}
          {singleRating ? (
            <Descriptions.Item label="icourse 评分">
              <RatingLink rating={singleRating} />
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      </div>

      <div className="course-detail-mobile">
        <section className="mobile-card course-detail-summary-card">
          <div className="mobile-field">
            <span className="mobile-field__label">课堂号 / 班次</span>
            <span className="mobile-field__value mobile-field__value--mono">{sectionLabel}</span>
          </div>
          <div className="mobile-field">
            <span className="mobile-field__label">授课教师</span>
            <span className="mobile-field__value">{formatTeacherList(display.teachers, '—')}</span>
          </div>
          <div className="mobile-field">
            <span className="mobile-field__label">学分 / 学时</span>
            <span className="mobile-field__value">{rep?.credits ?? 0} / {rep?.hours ?? 0}</span>
          </div>
          <div className="mobile-field mobile-field--pair">
            <span>
              <span className="mobile-field__label">考核方式</span>
              <span className="mobile-field__value">{examType}</span>
            </span>
            <span>
              <span className="mobile-field__label">评分制</span>
              <span className="mobile-field__value">{grading}</span>
            </span>
          </div>
          <div className="mobile-field mobile-field--pair">
            <span>
              <span className="mobile-field__label">课程类型</span>
              <span className="mobile-field__value">{rep?.courseType ?? '—'}</span>
            </span>
            <span>
              <span className="mobile-field__label">授课语言</span>
              <span className="mobile-field__value">{rep?.language ?? '—'}</span>
            </span>
          </div>
          <div className="mobile-field">
            <span className="mobile-field__label">开课单位</span>
            <span className="mobile-field__value">{rep?.department.name ?? '—'}（{rep?.department.code ?? ''}）</span>
          </div>
          {rep?.undergradShared ? (
            <div className="mobile-field">
              <span className="mobile-field__label">本研同堂</span>
              <span className="mobile-field__value">是</span>
            </div>
          ) : null}
          {singleRating ? (
            <div className="mobile-field">
              <span className="mobile-field__label">icourse 评分</span>
              <span className="mobile-field__value"><RatingLink rating={singleRating} /></span>
            </div>
          ) : null}
        </section>
      </div>

      {mergedTimeGroups ? (
        <section className="course-time-groups" aria-label="时间组明细">
          <Typography.Title level={5}>时间组明细</Typography.Title>
          <div className="course-detail-desktop">
            <Table
              className="detail-table detail-time-group-table"
              size="small"
              dataSource={timeGroupRows}
              pagination={false}
              tableLayout="fixed"
              columns={[
                { title: '时间组', dataIndex: 'label', width: 90 },
                { title: '课堂号 / 班次', dataIndex: 'sections', width: 170 },
                { title: '教师', dataIndex: 'teachers', width: 160 },
                { title: '时间地点', dataIndex: 'schedule' },
              ]}
            />
          </div>
          <div className="mobile-card-list course-detail-mobile">
            {timeGroupRows.map((row) => (
              <article className="mobile-card course-detail-time-group-card" key={row.key}>
                <div className="mobile-card__head">
                  <span className="mobile-card__title">{row.label}</span>
                  <span className="mobile-card__meta">{row.sections}</span>
                </div>
                <div className="mobile-card__line">{row.teachers}</div>
                <div className="mobile-card__line">{row.schedule}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="course-material-groups" aria-label="教材与参考资料">
        <Typography.Title level={5}>教材与参考资料</Typography.Title>
        <div className="course-material-group">
          <span className="course-material-group__label">参考书</span>
          <div className="course-material-group__value">{materialDisplay.referenceBooks}</div>
        </div>
        <div className="course-material-group">
          <span className="course-material-group__label">教材</span>
          <div className="course-material-group__value">{materialDisplay.textbooks}</div>
        </div>
        <div className="course-material-group">
          <span className="course-material-group__label">讲义</span>
          <div className="course-material-group__value">{materialDisplay.materials}</div>
        </div>
      </section>

      {display.sections.length > 1 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 16 }}>班次明细</Typography.Title>
          <Table
            className="detail-table detail-section-table"
            size="small"
            dataSource={sectionRows}
            pagination={false}
            tableLayout="fixed"
            columns={[
              { title: '课堂号', dataIndex: 'id', width: 110 },
              { title: '教师', dataIndex: 'teacher', width: 120 },
              { title: '时间地点', dataIndex: 'time', width: 360 },
              { title: '选课/限选', dataIndex: 'capacity', width: 96, render: (_: unknown, r: { enrolled: number; capacity: number }) => `${r.enrolled} / ${r.capacity}` },
              { title: '评分', dataIndex: 'rating', width: 110, render: (v: IcourseRatingInfo | undefined) => <RatingLink rating={v} /> },
              { title: '上课班级', dataIndex: 'classes', width: 240 },
            ]}
          />
          <div className="mobile-card-list course-detail-mobile">
            {sectionRows.map((row) => (
              <article className="mobile-card course-detail-section-card" key={row.key}>
                <div className="mobile-card__head">
                  <span className="mobile-card__title">{row.id}</span>
                  <span className="mobile-card__meta">{row.enrolled} / {row.capacity}</span>
                </div>
                <div className="mobile-card__line">{row.teacher}</div>
                <div className="mobile-card__line">{row.time}</div>
                <div className="mobile-card__line">上课班级：{row.classes}</div>
                <div className="mobile-card__foot">
                  <span>{row.room}</span>
                  <RatingLink rating={row.rating} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {!mergedTimeGroups ? (
        <>
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
              { title: '时间 / 节次', dataIndex: 'time', width: 130 },
              { title: '教室', dataIndex: 'room' },
            ]}
          />
          <div className="mobile-card-list course-detail-mobile">
            {scheduleRows.map((row) => (
              <article className="mobile-card course-detail-schedule-card" key={row.key}>
                <div className="mobile-card__head">
                  <span className="mobile-card__title">{row.weeks}</span>
                  <span className="mobile-card__meta">
                    {row.day} · {row.time}{row.exactTime ? '' : ' 节'}
                  </span>
                </div>
                <div className="mobile-card__line">{row.room}</div>
                <div className="mobile-card__subline">展开周：{row.weeksExpanded || '—'}</div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </BottomModal>
  );
}
