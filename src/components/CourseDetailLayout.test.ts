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

    for (const label of ['学分 / 学时', '学历层次', '课程类型', '考核方式', '评分制', '授课语言']) {
      expect(source).toContain(`label="${label}"`);
    }

    expect(occurrenceCount(source, '学历层次')).toBeGreaterThanOrEqual(2);
    expect(source).not.toContain('label="课程范畴"');
    expect(source).not.toContain('mobile-field__label">课程范畴');

    expect(source).not.toContain('<Tag color="blue">是</Tag>');
  });

  it('shows enrollment and capacity in both single-section overviews only', () => {
    expect(source).toContain(
      'const singleSection = display.sections.length === 1 ? display.sections[0] : undefined;',
    );
    expect(source).toContain('<Descriptions.Item label="选课/限选">');
    expect(source).toContain('mobile-field__label">选课/限选');
    expect(occurrenceCount(source, 'singleSection.enrolled} / {singleSection.capacity')).toBe(2);
    expect(occurrenceCount(source, '{singleSection ? (')).toBe(2);
    expect(source).toContain('{display.sections.length > 1 && (');
  });

  it('coalesces the detailed schedule rows with the shared display utility', () => {
    expect(source).toContain('coalesceScheduleSlots(display.schedule)');
    expect(source).toContain('formatActiveWeeks(s.activeWeeks)');
    expect(source).toContain("s.activeWeeks.join(', ')");
  });

  it('renders long material text once in a shared grouped section', () => {
    expect(source).toContain('className="course-material-groups"');
    expect(source).toContain('className="course-material-group"');
    expect(occurrenceCount(source, 'materialDisplay.referenceBooks')).toBe(1);
    expect(occurrenceCount(source, 'materialDisplay.textbooks')).toBe(1);
    expect(occurrenceCount(source, 'materialDisplay.materials')).toBe(1);
    expect(styles).toContain('.course-material-group__value');
  });

  it('shows teaching materials before merged time-group details', () => {
    expect(source.indexOf('aria-label="教材与参考资料"')).toBeLessThan(
      source.indexOf('aria-label="时间组明细"'),
    );
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
    expect(source).toContain("{ title: '操作', key: 'action'");
    expect(source).toContain('className="course-detail-time-group-action"');
    expect(source).toContain("dispatch({ type: 'removeCourses', courseIds: ids })");
    expect(source).toContain("dispatch({ type: 'addCourses', courseIds: ids })");
  });

  it('favorites each real time group in desktop, mobile, and ordinary modal actions', () => {
    expect(source).toContain('FavoriteButton');
    expect(source).toContain('favorite: timeGroupKeys.has(timeGroup.key)');
    expect(source).toContain("toggleFavorite('timeGroup', row.group.key)");
    expect(source).toContain("toggleFavorite('timeGroup', display.key)");
    expect(source).toContain('renderTimeGroupActions(row)');
    expect(occurrenceCount(source, 'renderTimeGroupActions(row)')).toBe(1);
  });

  it('uses a standalone favorite column for desktop time-group details', () => {
    expect(source).toContain(
      "{ title: '收藏', key: 'favorite', width: 64, align: 'center', render: (_: unknown, row: TimeGroupRow) => renderTimeGroupFavorite(row) }",
    );
    expect(source).toContain(
      "{ title: '操作', key: 'action', width: 132, align: 'left', render: (_: unknown, row: TimeGroupRow) => renderTimeGroupAction(row) }",
    );
  });

  it('favorites concrete sections in the desktop table and mobile section cards', () => {
    expect(source).toContain('<Table<SectionRow>');
    expect(source).toContain('favorite: sectionIds.has(s.id)');
    expect(source).toContain("toggleFavorite('section', row.id)");
    expect(source).toContain("{ title: '收藏', key: 'favorite'");
    expect(source).toContain('renderSectionFavorite(row)');
    expect(occurrenceCount(source, 'renderSectionFavorite(row)')).toBe(2);
  });

  it('does not duplicate the concrete section favorite in a single-section overview', () => {
    expect(source).toContain('renderSingleSectionIdentity()');
    expect(occurrenceCount(source, 'renderSingleSectionIdentity()')).toBe(2);
    expect(source).not.toContain('sectionRows[0] ? renderSectionFavorite(sectionRows[0]) : null');
  });
});
