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
});
