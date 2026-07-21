import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

const bottomModalProps = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock('./BottomModal', () => ({
  default: (props: {
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
  }) => {
    bottomModalProps.calls.push(props as Record<string, unknown>);
    return createElement(
      'section',
      null,
      createElement('h1', null, props.title),
      props.children,
      props.footer,
    );
  },
}));

import EducationLevelReminderModal from './EducationLevelReminderModal';

const source = readFileSync(new URL('./EducationLevelReminderModal.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const reminderContextSource = readFileSync(
  new URL('../updates/EducationLevelReminderContext.tsx', import.meta.url),
  'utf8',
);
const body = '新增学历层次选项，请注意检查所选课堂为本科生课堂还是研究生课堂，本科生选研究生课请先联系开课单位研究生教学秘书设置本研同堂，再联系开课单位本科教学秘书设为参选。本科生只有选修本研贯通课程获得的学分，可作为本科生学士学位毕业有效学分。';

describe('EducationLevelReminderModal', () => {
  test('uses the shared animated modal with the exact standalone reminder copy', () => {
    bottomModalProps.calls.length = 0;
    const onClose = vi.fn();
    const afterClose = vi.fn();
    const html = renderToStaticMarkup(createElement(EducationLevelReminderModal, {
      open: true,
      onClose,
      afterClose,
    }));

    expect(html).toContain('<h1>提醒</h1>');
    expect(html).toContain(body);
    expect(html).toContain('我已知晓');
    expect(bottomModalProps.calls).toHaveLength(1);
    expect(bottomModalProps.calls[0]).toMatchObject({
      open: true,
      title: '提醒',
      onClose,
      afterClose,
    });
    expect(source).toContain("import BottomModal from './BottomModal'");
    expect(source).toContain('afterClose={afterClose}');
  });

  test('is wired as an isolated old-user reminder before ordinary update notices', () => {
    expect(appSource).toContain("import EducationLevelReminderModal from '@/components/EducationLevelReminderModal'");
    expect(appSource).toContain('useEducationLevelReminder');
    expect(reminderContextSource).toContain('initializeEducationLevelReminder');
    expect(mainSource.indexOf('<EducationLevelReminderProvider>')).toBeLessThan(
      mainSource.indexOf('<SemesterCatalogProvider>'),
    );
    expect(appSource).toMatch(
      /educationLevelReminderPending\s*\|\|\s*educationLevelReminderOpen/,
    );
    expect(appSource).toContain('EDUCATION_LEVEL_REMINDER: standalone rollout warning; safe to edit or remove independently.');
    expect(appSource.indexOf('<EducationLevelReminderModal')).toBeLessThan(
      appSource.indexOf('<UpdateNoticeModal'),
    );
  });

  test('tightens spacing only inside the standalone reminder modal', () => {
    expect(cssSource).toMatch(
      /\.education-level-reminder-modal\s+\.bottom-modal__header\s*\{[^}]*padding-block:\s*14px 8px;/s,
    );
    expect(cssSource).toMatch(
      /\.education-level-reminder-modal\s+\.bottom-modal__body\s*\{[^}]*padding-block:\s*0 12px;/s,
    );
    expect(cssSource).toMatch(
      /\.education-level-reminder-modal\s+\.bottom-modal__body\s*>\s*p\s*\{[^}]*margin-block:\s*0;/s,
    );
    expect(cssSource).toMatch(
      /\.education-level-reminder-modal\s+\.bottom-modal__footer\s*\{[^}]*padding-block:\s*8px 12px;/s,
    );
  });
});
