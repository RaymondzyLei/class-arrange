import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CourseDetailModal.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function occurrenceCount(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

describe('course detail layout', () => {
  it('keeps ordinary course metadata in a compact bordered table', () => {
    expect(source).toContain('className="course-detail-overview"');
    expect(source).toContain('column={3}');

    for (const label of ['学分 / 学时', '课程类型', '考核方式', '评分制', '授课语言']) {
      expect(source).toContain(`label="${label}"`);
    }

    expect(source).not.toContain('<Tag color="blue">是</Tag>');
  });

  it('renders long material text once in a shared grouped section', () => {
    expect(source).toContain('className="course-material-groups"');
    expect(source).toContain('className="course-material-group"');
    expect(occurrenceCount(source, 'materialDisplay.referenceBooks')).toBe(1);
    expect(occurrenceCount(source, 'materialDisplay.textbooks')).toBe(1);
    expect(occurrenceCount(source, 'materialDisplay.materials')).toBe(1);
    expect(styles).toContain('.course-material-group__value');
  });

  it('keeps section detail columns readable without vertical text wrapping', () => {
    expect(source).toContain('className="detail-table detail-section-table"');
    expect(source).not.toContain('scroll={{ x: 1040 }}');
    expect(source).toContain("{ title: '时间地点', dataIndex: 'time', width: 360 }");
    expect(source).toContain("{ title: '上课班级', dataIndex: 'classes', width: 240 }");
    expect(styles).toContain('@media (max-width: 1080px)');
    expect(styles).toContain('.course-detail-modal .detail-section-table');
  });

  it('shows every source time group when a course card is merged', () => {
    expect(source).toContain('const mergedTimeGroups = display.timeGroups');
    expect(source).toContain('时间组明细');
    expect(source).toContain('className="detail-table detail-time-group-table"');
    expect(source).toContain("{ title: '时间组', dataIndex: 'label'");
    expect(source).toContain("{ title: '时间地点', dataIndex: 'schedule'");
    expect(source).toContain('{!mergedTimeGroups ? (');
    expect(styles).toContain('.detail-time-group-table');
  });

  it('offers an independent selection action for every merged time group', () => {
    expect(source).toContain('selected: idsForGroup(timeGroup).every');
    expect(source).toContain('toggleTimeGroupSelected(row.group)');
    expect(source).toContain("row.selected ? '移除此时间组' : '选择此时间组'");
    expect(source).toContain("{ title: '操作'");
    expect(source).toContain("{ title: '操作', key: 'action', width: 132, align: 'left'");
    expect(source).toContain('className="course-detail-time-group-action"');
    expect(source).toContain("dispatch({ type: 'removeCourses', courseIds: ids })");
    expect(source).toContain("dispatch({ type: 'addCourses', courseIds: ids })");
  });
});
