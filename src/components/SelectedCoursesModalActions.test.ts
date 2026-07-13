import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./SelectedCoursesModal.tsx', import.meta.url),
  'utf8',
);

describe('SelectedCoursesModal chooser actions', () => {
  it('labels both multi-time-group chooser buttons without implying a specific group', () => {
    const chooserLabel = "{row.selected ? '修改所选时间组' : '选择时间组'}";
    const misleadingLabel = "{row.selected ? '修改所选时间组' : '选择此时间组'}";

    expect(source.split(chooserLabel)).toHaveLength(3);
    expect(source).not.toContain(misleadingLabel);
  });
});
