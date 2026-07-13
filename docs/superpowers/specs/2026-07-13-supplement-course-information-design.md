# 补充课程信息与多学期数据设计

## 目标

建立一条可重复执行的开课数据流水线：用户运行一次命令，在脚本打开的可见浏览器中完成统一身份认证后，脚本读取指定学期的全部课堂列表和课堂详情，生成前端可直接消费的单学期 `courses.json`。本次落地 2026 年秋季学期和 2026 年夏季学期；后续新增学期只需再次运行同一命令。

网站启动时只加载一个很小的学期索引和用户当前选择学期的一个 `courses.json`。排课方案与学期绑定；切换学期不会混用课程、方案或课堂号。

## 已确认需求

- 从 `https://catalog.ustc.edu.cn/query/lesson` 读取开课信息，详情以点击课程名后对应的课堂详情接口为准。
- 保存评分制、英文课程名、课程简介、先修要求、教学大纲、教材、讲义、参考书等完整详情。
- 详情数据与课堂列表物理上合并在同一个学期 `courses.json` 中；暂未展示的字段仍保留。
- 详情卡片中，评分制与考核方式位于同一行；教材和参考书加入详情表格。
- 搜索区增加评分制筛选。
- 每学期独立生成数据，前端选择学期时只加载该学期的 `courses.json`。
- 课表标题中的学期文字样式保持不变，文字右侧增加展开按钮；复用现有 Chevron 旋转动画、图标按钮和 Ant Design 下拉动效。
- 排课方案按学期独立存储。
- 本次提交包含 2026 年秋季和 2026 年夏季数据，默认学期为 2026 年秋季。
- 保留 `scripts/excel_to_ts.py` 作为旧流程兼容工具，但不再作为推荐的数据更新方式。

## 数据源与认证

开课页面是静态 SPA，真正数据来自以下同源接口：

- `GET /api/teach/semester/list`
- `GET /api/teach/lesson/list-for-teach/{semesterId}`
- `POST /api/teach/lesson/infos`，请求体为 `{ "codes": [...], "semester": semesterId }`

`list-for-teach` 一次返回整学期列表，页面分页只是客户端分页。评分制、教材、参考书和课程简介等详情不在列表接口中，必须调用 `lesson/infos`。

认证采用 Playwright 持久浏览器配置：

1. 命令打开一个可见的 Edge/Chromium 窗口和课程查询页。
2. 若尚未登录，用户自行完成 CAS 登录；脚本不读取密码、验证码或 Cookie 内容。
3. 浏览器上下文内的 API 请求自动共享 HttpOnly 会话 Cookie。
4. 本地浏览器配置目录被 Git 忽略，不进入生成数据或提交记录。

内置浏览器适合核对页面和样例，但其只读页面执行环境不能批量发起 API 请求，也不支持下载事件。因此可复用命令使用独立、可见的持久浏览器；这也是后续每学期无需复制 Cookie 的稳定方案。

## 文件布局

```text
catalog_spider/
├── lesson_sync.py                 # 登录、抓取、断点续传和编排
├── lesson_transform.py            # API → 前端 schema 纯函数转换
├── semester_calendar.py           # 学期日历覆盖配置合并
├── data/
│   └── raw/lessons/<semester-key>/ # 本地原始响应与断点文件，Git 忽略
└── tests/
    ├── fixtures/lessons_*.json
    ├── test_lesson_sync.py
    └── test_lesson_transform.py

public/data/semesters/
├── index.json
├── 2026-fall/courses.json
└── 2026-summer/courses.json

src/data/
├── semesterCatalog.ts             # manifest/catalog 校验与 fetch
└── SemesterCatalogContext.tsx     # 当前学期数据和切换事务
```

原始响应用于断点续传和排查上游变化，但不提交 Git。前端生成文件完整、确定性排序、可直接部署。

## 前端文件契约

### 学期索引

`public/data/semesters/index.json` 只包含轻量元数据：

```json
{
  "schemaVersion": 1,
  "defaultSemester": "2026-fall",
  "semesters": [
    {
      "key": "2026-fall",
      "name": "2026年秋季学期",
      "file": "2026-fall/courses.json"
    },
    {
      "key": "2026-summer",
      "name": "2026年夏季学期",
      "file": "2026-summer/courses.json"
    }
  ]
}
```

学期按开始日期倒序排列。`defaultSemester` 由抓取命令的 `--activate` 更新。

### 单学期课程文件

每个 `courses.json` 的顶层结构为：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-13T00:00:00Z",
  "source": {
    "url": "https://catalog.ustc.edu.cn/query/lesson",
    "semesterId": 461
  },
  "semester": {
    "key": "2026-fall",
    "name": "2026年秋季学期",
    "startDate": "2026-08-31",
    "endDate": "2027-01-17",
    "calendar": {
      "termId": "2026-fall",
      "termName": "2026年秋季学期",
      "weekStartDate": "2026-08-31",
      "weekCount": 20,
      "sourceUrl": "https://www.teach.ustc.edu.cn/calendar/20135.html",
      "holidays": {},
      "makeupDays": {}
    }
  },
  "courses": [],
  "detailsBySection": {}
}
```

`courses` 延续现有 `CourseSection[]`，并增加 `grading`。`detailsBySection` 以完整课堂号为键保存课堂详情，避免同一详情在多个索引中重复，也允许以后只改 UI 就显示当前未展示字段。

课堂详情保留并规范化以下字段：

- `code`
- `name.cn`、`name.en`
- `dept`、`credit`、`hour`、`sem`
- `grading`、`examType`、`discipline`、`lang`
- `prerequisite`
- `legacyTextbook`
- `textbooks[]`：`nameZh`、`edition`、`author`、`publishingHouse`、`dates`、`isbn`、`publish`
- `materials[]`：从 `textbooks[publish=false]` 派生，同时保留原记录
- `referenceBooks`
- `description.cn`、`description.en`
- `syllabus`

评分制按开放字符串保存，不硬编码枚举；空值规范为 `""`。筛选选项从当前已加载学期的课程动态派生。

## 抓取命令与流程

推荐命令：

```powershell
uv run --group spider python -m catalog_spider sync-lessons `
  --semester "2026年秋季学期" `
  --semester "2026年夏季学期" `
  --activate "2026年秋季学期"
```

以后更新单个学期：

```powershell
uv run --group spider python -m catalog_spider sync-lessons `
  --semester "2027年春季学期" `
  --activate "2027年春季学期"
```

每个学期的执行顺序：

1. 读取学期列表并按中文名称精确匹配；找不到时失败，不猜测 ID。
2. 拉取整学期课堂列表，写入原始断点文件。
3. 以 50 个课堂号为一批串行请求 `lesson/infos`。
4. 每批成功后原子写入详情断点；失败按指数退避重试 3 次。
5. 断点重跑时只请求尚未成功保存的课堂号。
6. 校验列表课堂号唯一、详情覆盖率 100%、响应详情课堂号均属于目标学期。
7. 纯函数转换并确定性排序，原子写入对应 `courses.json`。
8. 更新 `index.json`；只有显式传入 `--activate` 才改变默认学期。

若任何批次最终失败、详情缺失、schema 不匹配或输出校验失败，则保留断点但不覆盖上一次有效的前端文件。

## 学期日历

上游学期对象提供开始/结束日期，但节假日、调课日可能需要教学校历覆盖。生成器先根据开始/结束日期计算周数，再合并仓库中的按学期日历覆盖：

- 2026 秋季沿用现有教学校历的休假与补课配置。
- 2026 夏季使用上游起止日期；若没有特别调课则覆盖为空。
- 新学期无覆盖时仍可正常显示周次和日期；后续补充覆盖不会要求重新抓取课程详情。

日历最终写入同一个 `courses.json`，切换学期时课程与日历原子切换。

## 前端加载与切换事务

应用启动：

1. 读取 `/data/semesters/index.json`。
2. 读取 `localStorage` 中上次选择的学期 key；若不存在于索引，使用 `defaultSemester`。
3. 仅 fetch 对应的一个 `courses.json`。
4. 数据校验通过后创建课程索引、课程分组、筛选选项和动态日历。

切换学期：

1. 保持当前学期页面不变并显示轻量加载状态。
2. fetch 目标 `courses.json`；快速连续选择时中止过期请求。
3. 成功后一次性替换课程、详情、分组、筛选选项、日历和方案命名空间。
4. 清空课程筛选、周次选择、详情弹窗和临时排课组合。
5. 保存新的学期 key。
6. 失败时保留当前数据和当前方案，并显示错误消息。

不预取其他学期数据，不持久缓存多个 `courses.json`。切换成功前内存中可短暂保留旧数据，避免空白页。

## 排课方案与学期绑定

方案存储键改为：

```text
class-arrange:v2:plans:<semester-key>
```

`PlansProvider` 接收 `semesterKey`。学期 key 变化时：

- 立即从对应 key 加载该学期方案；不存在则创建“方案一”。
- 后续增删课程只写入当前学期键。
- 旧的 `class-arrange:v1:plans` 只在默认学期首次加载且 v2 数据不存在时迁移一次，避免用户现有秋季方案丢失。
- 其他学期永不读取这份旧数据。

## 学期下拉 UI

课表头部保持现有两行布局：第一行学期名称，第二行日期范围。第一行增加一个内联容器：

```text
2026年秋季学期  [⌄]
```

- 学期名称继续使用 `.course-table__term-name`。
- 图标按钮使用 Ant Design `Button type="text"` 和现有 32px 图标按钮视觉语言。
- 图标复用 `ChevronIcon`、`.select-chevron`、`.select-chevron--open`，展开时旋转 180°。
- 菜单使用 Ant Design `Dropdown`，复用现有进入/离开动画和主题样式。
- 按钮具备 `aria-label="选择学期"`、`aria-expanded`，支持键盘。
- 选择当前学期不重复加载；加载目标学期时禁用重复操作。

## 筛选与详情展示

`FilterState` 增加 `grading`。筛选栏从当前学期数据动态派生评分制选项，并按开放字符串精确匹配；其他筛选选项也不再引用静态课程模块。

详情以当前组代表课堂为主；本次数据按课堂号保存。若同组班次的评分制或详情不同，详情显示代表课堂值，并在班次明细中保留每个课堂号，数据层不丢失差异。

桌面详情表：

- “考核方式”和“评分制”占同一行两列。
- “教材 / 讲义”和“参考书”各占完整一行；无值显示 `—`。
- 教材优先显示结构化条目；`publish=false` 标记为讲义；只有结构化条目为空时才回退旧版教材文本。

移动详情：

- “考核方式”和“评分制”使用现有成对字段布局。
- 教材、讲义、参考书使用单列字段，保持可换行文本。

英文名、课程简介、先修要求、教学大纲等本次只存储，不改变现有界面；以后可直接从 `detailsBySection` 开启显示。

## 测试与验收

Python：

- 学期精确匹配与 key 生成。
- 课堂列表/详情转换，包括空字段、英文名 `"1"`、教材与讲义拆分。
- 详情覆盖率、重复课堂号、外来课堂号校验。
- 50 条批次、断点续抓、重试与失败时不覆盖有效输出。
- manifest 合并、默认学期更新和确定性 JSON 输出。

TypeScript：

- manifest 选择：持久选择有效、失效时回退默认。
- schema 校验和加载失败保留当前数据。
- 课程索引/分组基于传入数据，不再使用模块级静态缓存。
- 评分制选项与筛选。
- 方案存储键、默认学期旧方案迁移和跨学期隔离。
- 动态日历函数对夏、秋学期均正确。

集成验收：

- 首次加载只出现 `index.json` 和默认学期 `courses.json` 的网络请求。
- 下拉切换到夏季后只新增夏季 `courses.json` 请求，课表标题、日期和课程总数同步切换。
- 秋、夏两学期分别添加课程后往返切换，方案互不影响。
- 评分制筛选结果与课堂详情一致。
- 详情中评分制与考核方式同一行，教材和参考书可见。
- 桌面与窄屏布局无溢出，Chevron 展开/收起动画与现有控件一致。

