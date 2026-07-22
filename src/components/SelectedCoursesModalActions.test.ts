import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./SelectedCoursesModal.tsx', import.meta.url),
  'utf8',
);
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('SelectedCoursesModal chooser actions', () => {
  it('labels both multi-time-group chooser buttons without implying a specific group', () => {
    const chooserLabel = "{row.selected ? '修改所选时间组' : '选择时间组'}";
    const misleadingLabel = "{row.selected ? '修改所选时间组' : '选择此时间组'}";

    expect(source.split(chooserLabel)).toHaveLength(3);
    expect(source).not.toContain(misleadingLabel);
  });

  it('opens the existing merged detail when a selected course is incomplete', () => {
    expect(source).toContain('onOpenAllTimeGroups: (courseCode: string) => void;');
    expect(source).toContain('查看全部时间组');
    expect(source).toContain('onOpenAllTimeGroups(group.courseCode)');
    expect(appSource).toContain('const openAllTimeGroupsFromManager = (courseCode: string) => {');
    expect(appSource).toContain('const mergedGroup = mergedGroupByCode.get(courseCode);');
    expect(appSource).toContain('setDetailGroupKey(mergedGroup.key)');
    expect(appSource).toContain('onOpenAllTimeGroups={openAllTimeGroupsFromManager}');
    expect(appSource).toContain('if (explicitMergedGroup?.timeGroups) return explicitMergedGroup;');
  });

  it('replaces the entry button with a complete-course status after every time group is selected', () => {
    expect(source).toContain('已选择此课程全部时间组');
    expect(source).toContain('className="selected-courses-time-group-status"');
    expect(styles).toContain('.selected-courses-time-group-status');
  });

  it('keeps the selected-course schedule column readable beside the action buttons', () => {
    expect(source).toContain("{ title: '时间地点', dataIndex: 'schedule', width: 250 }");
    expect(source).toMatch(/title: '操作',\r?\n\s+width: 260,/);
    expect(source).toContain('className="detail-table selected-courses-table selected-courses-group-table"');
    expect(source).toContain('scroll={{ x: 1155 }}');
    expect(source).toContain('tableLayout="fixed"');
    expect(styles).toContain('.selected-courses-group-table .ant-table');
    expect(styles).toContain('table-layout: fixed !important;');
  });

  it('only stops card activation keys inside the three mobile action wrappers', () => {
    expect(source).toContain('function stopMobileActionActivation(event: KeyboardEvent<HTMLDivElement>): void {');
    expect(source).toContain("if (event.key === 'Enter' || event.key === ' ') {");
    expect(source.match(/onKeyDown=\{stopMobileActionActivation\}/g)).toHaveLength(3);
    expect(source).not.toContain('onKeyDown={(event) => event.stopPropagation()}');
  });

  it('does not fall back to a destructive confirm action when no action is selected', () => {
    expect(source).toContain(": confirmAction === 'clearPlan'");
    expect(source).toMatch(/: confirmAction === 'clearPlan'[\s\S]*?: null;/);
    expect(source).toContain('onClick={confirmDialog.onConfirm}');
    expect(source).toContain('footer={confirmDialog ? (');
    expect(source).toContain('{confirmDialog ? (');
    expect(source).not.toContain("confirmAction === 'batchRemove' ? removeSelectedGroups : clearActivePlan");
  });
});

describe('automatic notice overlay gating', () => {
  it('defers unopened notices until the overlay stack is empty without closing an open notice', () => {
    expect(appSource).toContain("import { useOverlayStackSnapshot } from '@/components/overlayStack';");
    expect(appSource).toContain('const overlayStack = useOverlayStackSnapshot();');
    expect(appSource).toContain(
      'const hasActiveOverlay = overlayStack.length > 0;',
    );
    expect(appSource).toContain(
      'if (educationLevelReminderOpen || educationLevelReminderClosingRef.current) return undefined;',
    );
    expect(appSource).toContain(
      'if (automaticNoticeOpen || automaticNoticeClosingRef.current) return undefined;',
    );
    expect(appSource.match(/if \(hasActiveOverlay\) return undefined;/g)).toHaveLength(2);
  });
});
