import type { ReactNode } from 'react';

export type TourPlacement = 'right' | 'bottom' | 'left' | 'top' | 'center';

export interface TourStep {
  id: string;
  target?: string;
  targets?: string[];
  title: string;
  /** 支持字符串或 ReactNode；用 ReactNode 时可在描述里嵌入链接、自定义元素 */
  description: ReactNode;
  tip?: string;
  placement: TourPlacement;
  action?: 'openSelectedCoursesCurriculum' | 'closeSelectedCourses' | 'openCustomization' | 'closeCustomization';
  clickTarget?: string;
  entryAnimation?: 'float';
  mergeTargets?: boolean;
  preview?: 'arrangementPanel';
}

export const tourSteps: TourStep[] = [
  {
    id: 'scheme-list',
    targets: ['[data-tour="scheme-list"]', '[data-tour="plan-stats"]'],
    title: '管理我的方案',
    description: '这里是当前方案和方案操作区。你可以新建方案、删除当前方案，也可以在更多菜单里复制或重命名方案。下方可以看到当前方案的信息。',
    placement: 'right',
    entryAnimation: 'float',
  },
  {
    id: 'arrangement-preview',
    target: '[data-tour="arrangement-preview"]',
    title: '了解排课方案',
    description: '排课方案是基于当前“我的方案”自动生成的课表安排，会按冲突课程数从少到多排序，最多展示 8 种可选方案。“我的方案”是你保存的一组选课清单；“排课方案”是在这组选课里生成的不同时间组组合。',
    placement: 'right',
    preview: 'arrangementPanel',
  },
  {
    id: 'program-selector',
    target: '[data-tour="program-selector"]',
    title: '添加培养方案',
    description: '你可以在这里选择或搜索培养方案，方便后续查看培养方案内课程并按学期辅助选课。',
    placement: 'right',
  },
  {
    id: 'course-search-area',
    target: '[data-tour="course-search-area"]',
    title: '搜索与筛选课程',
    description: '这里默认搜索课程名和课堂号；需要按教师姓名搜索时，请勾选“查询任课老师”。也可以用下方筛选框缩小范围。',
    tip: '点击搜索结果中的课程卡片可以查看课程详情。',
    placement: 'bottom',
  },
  {
    id: 'course-result-groups',
    target: '[data-tour="search-results"]',
    title: '理解同名课程分组',
    description: '如果看到课程名称和课程号完全一致的结果被分成多张卡片，这不是重复数据或 bug。系统会把同课程号且时间完全一致的班次合并；时间、周次、地点等不同的班次会作为不同时间组展示，方便你分别加入和排课。',
    placement: 'right',
  },
  {
    id: 'timetable-area',
    target: '[data-tour="timetable-area"]',
    title: '查看课表与操作',
    description: '右侧会展示当前方案的周课表。上方可以切换周数、切换深浅模式、打开自定义设置，也可以导出课表图片。',
    tip: '点击课表中的课程卡片可以查看课程详情。',
    placement: 'left',
  },
  {
    id: 'manage-entries',
    targets: ['[data-tour="selected-courses-manage"]', '[data-tour="curriculum-manage"]'],
    title: '管理入口',
    description: '这两个“管理”入口都可以打开课程管理面板。已选课程入口用于查看当前方案，培养方案入口会直接进入培养方案内课程。',
    action: 'closeSelectedCourses',
    placement: 'right',
  },
  {
    id: 'curriculum-management',
    targets: ['.selected-courses-tabs > .ant-tabs-nav', '[data-tour="selected-courses-curriculum-tools"]'],
    title: '按培养方案选课',
    description: '可以在此处调整培养方案、选择学期、一键选择培养方案中本学期必修课、清空培养方案选课，也可以前往公共查询系统核查原始培养方案。',
    action: 'openSelectedCoursesCurriculum',
    clickTarget: '[data-tour="curriculum-manage"]',
    placement: 'bottom',
    entryAnimation: 'float',
    mergeTargets: true,
  },
  {
    id: 'customization-entry',
    target: '[data-tour="customization"]',
    title: '打开自定义',
    description: '回到主页后，可以从这里进入自定义设置，调整排课倾向和占位时间。',
    action: 'closeSelectedCourses',
    placement: 'left',
  },
  {
    id: 'customization-preferences',
    target: '[data-tour="customization-preferences"]',
    title: '调整排课倾向',
    description: '在冲突课程尽可能少的前提下，按照所选倾向排列方案。',
    action: 'openCustomization',
    clickTarget: '[data-tour="customization"]',
    placement: 'right',
    entryAnimation: 'float',
  },
  {
    id: 'customization-blocked-slots',
    target: '[data-tour="customization-blocked-slots"]',
    title: '设置占位时间',
    description: '在占位表格中点选你不方便上课的时间，系统会把这些时间视为冲突并参与方案排序。',
    action: 'openCustomization',
    placement: 'top',
  },
  {
    id: 'complete',
    title: '准备就绪！',
    description: (
      <>
        现在你已经学会了这个工具的基础使用方法，祝您排课愉快！如果遇到问题或想提建议，欢迎前往{' '}
        <a
          className="tour-card__inline-link"
          href="https://github.com/RaymondzyLei/class-arrange"
          target="_blank"
          rel="noreferrer"
        >
          GitHub 仓库
        </a>
        {' '}提 issue 或 pr，欢迎点 star。
        <br />
        欢迎访问制作者的个人主页{' '}
        <a
          className="tour-card__inline-link"
          href="https://raymondzylei.me/"
          target="_blank"
          rel="noreferrer"
        >
          RaymondzyLei
        </a>
        {' '}了解更多，欢迎访问第二制作者的主页{' '}
        <a
          className="tour-card__inline-link"
          href="https://github.com/syhalex/"
          target="_blank"
          rel="noreferrer"
        >
          syhalex
        </a>
        {' '}。
        <br />
        <br />
        贡献列表：
        <br />
        1.{' '}
        <a
          className="tour-card__inline-link"
          href="https://github.com/RaymondzyLei"
          target="_blank"
          rel="noreferrer"
        >
          RaymondzyLei
        </a>
        <br />
        2.{' '}
        <a
          className="tour-card__inline-link"
          href="https://github.com/claude"
          target="_blank"
          rel="noreferrer"
        >
          Claude
        </a>
        <br />
        3.{' '}
        <a
          className="tour-card__inline-link"
          href="https://github.com/syhalex"
          target="_blank"
          rel="noreferrer"
        >
          syhalex
        </a>
        <br />
        4.{' '}
        <a
          className="tour-card__inline-link"
          href="https://github.com/openai/codex"
          target="_blank"
          rel="noreferrer"
        >
          Codex
        </a>
        <br />
        5.{' '}
        <a
          className="tour-card__inline-link"
          href="https://github.com/quantai1314"
          target="_blank"
          rel="noreferrer"
        >
          Quantai
        </a>
        <br />
        <br />
        再次查看引导可以从“自定义”里的“重新查看新手引导”进入。
      </>
    ),
    action: 'closeCustomization',
    placement: 'center',
  },
];
