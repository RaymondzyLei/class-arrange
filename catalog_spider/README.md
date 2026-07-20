# catalog_spider

USTC 教务系统培养方案爬虫 + 前端数据生成。

同一 CLI 也负责从全校开课查询同步按学期课程列表与课堂详情。

数据源：https://catalog.ustc.edu.cn/plan
- `GET /api/teach/program/tree` — 全量目录（1184 个；本项目只取 grade≥2023 的 494 个）
- `GET /api/teach/program/info/{id}` — 单个培养方案完整数据（递归 moduleTree，含课程清单）

> **鉴权说明（2026-07 校验）**：早期 `program/tree` / `program/info` 确实可匿名访问，但当前教务系统已收紧——
> 从校园网外用零 cookie 的裸请求探测，`program/tree`、`semester/list` 等接口一律返回 **401**（空响应体、无重定向），
> 排除了 UA / `Referer` / `Accept` 等因素。`catalog.ustc.edu.cn` 走 USTC 统一身份认证（CAS/SSO）：
> 在浏览器里"不用登录就能查信息"，是因为浏览器带着尚未过期的 SSO cookie；脱离会话的请求必须先取得登录态。
> 因此 `lesson_sync.py` 用 Playwright 启动持久化浏览器完成一次登录，后续 API 调用复用同一 profile 的 cookie。
> 仅 `client.py`（培养方案裸爬）仍保留浏览器 UA，规避历史 502，但它不再保证匿名可访问——需登录或校内网络环境。

---

## 工作流

```
catalog_spider fetch-tree      →  data/raw/program_tree.json
catalog_spider fetch-details   →  data/raw/programs/{id}.json      (494 个)
catalog_spider build-index     →  data/index/programs.json
catalog_spider build-by-term   →  data/index/by_program_term.json
                                                                    ↓
scripts/curricula_to_ts.py     →  src/data/curricula.ts            (前端 import)
```

---

## 用法

```powershell
# 首次 setup
uv sync --group spider --group dev

# 一次性跑完所有数据生成
uv run python -m catalog_spider all
uv run python scripts/curricula_to_ts.py

# 分步
uv run python -m catalog_spider fetch-tree        # 抓 program_tree（秒级）
uv run python -m catalog_spider fetch-details     # 抓 ~494 个 program 详情（断点续爬，~2 分钟）
uv run python -m catalog_spider build-index       # 生成轻量索引
uv run python -m catalog_spider build-by-term     # 生成按学期分组

# 测试
uv run pytest catalog_spider/tests -v
```

### 同步学期开课与完整详情

```powershell
# 推荐：脚本会在成功后自动校验全部发布文件
./scripts/sync_semester_courses.ps1 `
  -Semester '2026年秋季学期','2026年夏季学期' `
  -Activate '2026年秋季学期'

# 等价的底层命令
uv run --group spider python -m catalog_spider sync-lessons `
  --semester '2026年秋季学期' `
  --semester '2026年夏季学期' `
  --activate '2026年秋季学期'

uv run python -m catalog_spider validate-lessons --all
```

如果 raw 数据已经抓取完成，只修改了转换规则或学期日历，不需要再次登录或访问网站。直接从每学期独立保存的
`catalog_spider/data/raw/lessons/<semester-key>/{semester,lessons,details}.json`
重建发布文件：

```powershell
# 单学期重建，并将它设为网站默认学期
uv run python -m catalog_spider build-lessons `
  --semester-key 2026-fall `
  --activate 2026-fall

# 多学期一起重建；--semester-key 可重复
uv run python -m catalog_spider build-lessons `
  --semester-key 2026-fall `
  --semester-key 2026-summer

uv run python -m catalog_spider validate-lessons --all
```

`build-lessons` 是纯本地命令，不会打开浏览器或发送网络请求。它会先读取并转换所有指定学期，调用与在线同步相同的 catalog 校验，再一次性事务写入
`public/data/semesters/<semester-key>/courses.json`、`updates.json` 和 `index.json`；任一输入、转换、校验或写入失败时，现有发布文件保持不变。`--activate` 接受本次 `--semester-key` 中的一个 key；省略时保留 manifest 当前默认学期。

流程会打开可见的持久浏览器，并通过与页面共享认证状态的请求上下文读取：

- 学期目录；
- 指定学期全量课堂；
- 每个课堂的评分制、英文名、中英文简介、先修要求、教学大纲、教材、讲义和参考书等详情。

详情每 50 个课堂写一次原始断点到 `data/raw/lessons/<semester-key>/`。所有请求学期都抓取、转换并校验成功后，才事务性发布 `public/data/semesters/<semester-key>/courses.json`、`updates.json` 与 `index.json`；发布中途失败会恢复原文件，原始断点仍保留。

### 变更追踪（`updates.json` + `revision`）

每次发布都为学期目录算一个内容哈希 `revision`（SHA-256，剥离 `generatedAt`、`enrolled` 等易变字段、教师按排序归一），写进 `courses.json.revision` 与 manifest 条目的 `revision`。若与上一版不同，`course_updates.py` 会 diff 出 `added` / `removed` / `modified` 三类变化，追加一条记录到该学期的 `updates.json`：

- `removed` 课堂附带 `replacementCandidates`（优先同课程号、回退同名），供前端提示「替换失效课程」；
- `modified` 课堂列出字段级 `changes`（教师、时间、地点、详情等），不内嵌大段 HTML；
- 内容完全相同则不追加（幂等），重跑 `sync-lessons` 不会产生重复条目。

前端 `UpdateAwarenessContext` 据此在访问时弹「最近更新」，并把删除的课堂从用户方案中移除。

`validate-lessons` 除评分制和教材覆盖率外，还输出 `raw_schedule_non_empty`、`scheduled_courses` 与 `clock_time_courses`，便于同步或本地重建后立即发现课堂时间大量解析为空的问题。

**培养方案的 raw / index 不入 git**：clone 后 `catalog_spider/data/` 为空，需先跑 `fetch-tree` + `fetch-details` 抓取（约 2 分钟），再 `build-index` / `build-by-term` / `curricula_to_ts.py`。而**学期开课的发布文件 `public/data/semesters/*` 已入 git**（`index.json` + 每学期 `courses.json` / `updates.json`），前端无需抓取即可直接使用。

爬取范围：**仅 `grade >= 2023` 的培养方案**（详见 `catalog_spider/details.py:MIN_GRADE`）。

---

## 项目结构

```
catalog_spider/
├── __main__.py            # CLI 入口（8 个子命令，见下）
├── client.py              # 培养方案爬取的 HTTP 客户端（10 次重试 + 浏览器 UA，无鉴权）
├── tree.py                # 解析 program_tree.json + filter_by_min_grade
├── details.py             # 8 进程并发抓取 details（断点续爬，MIN_GRADE=2023）
├── process.py             # 从 raw 生成 index（programs.json + by_program_term.json）
├── paths.py               # 数据目录常量 + ensure_dirs()
├── lesson_sync.py         # 学期开课同步：Playwright 登录 + 3 个 API + 事务发布
├── lesson_transform.py    # 课堂/详情归一化、时间表解析、学期目录构建与校验
├── course_updates.py      # 内容哈希 revision + 与上一版 diff，生成 updates.json
├── semester_calendar.py   # 由学期起止算周数；CALENDAR_OVERRIDES 硬编码节假日/补课
├── README.md
├── tests/                 # 7 个文件、97 个 pytest 用例
│   ├── test_client.py / test_details.py / test_process.py / test_tree.py
│   ├── test_lesson_sync.py        # 同步流程、重试退避、断点续爬、事务回滚、CLI 参数
│   ├── test_lesson_transform.py   # 时间表解析、校区归类、校验规则、日历
│   ├── test_course_updates.py     # revision 幂等、diff、替换候选
│   └── fixtures/                  # program_3413 / program_tree_mini / lesson_list/lesson_details mini
└── data/                  # 不入 git（见下）：raw / index / browser-profile / raw/lessons
    ├── raw/{program_tree.json, programs/{id}.json, lessons/<key>/{semester,lessons,details}.json}
    └── index/{programs.json, by_program_term.json}

scripts/curricula_to_ts.py    # 从 index/* 生成 src/data/curricula.ts（前端 import）
```

### 子命令

培养方案侧（`all` 只跑这 4 个）：

| 命令 | 作用 |
|---|---|
| `fetch-tree` | 抓 `program_tree`（秒级） |
| `fetch-details` | 并发抓所有 program 详情（断点续爬） |
| `build-index` | 从 raw 生成 `index/programs.json` |
| `build-by-term` | 从 raw 生成 `index/by_program_term.json` |
| `all` | 按顺序跑完上面 4 个 |

学期开课侧：

| 命令 | 参数 | 作用 |
|---|---|---|
| `sync-lessons` | `--semester <中文名>`（可重复）、`--activate`、`--profile-dir` | 可见浏览器登录后同步指定学期开课与详情 |
| `build-lessons` | `--semester-key <key>`（可重复）、`--activate` | 从本地 raw JSON 重建，不联网不开浏览器 |
| `validate-lessons` | `--all` 或 `--semester-key <key>`（二选一） | 校验已发布学期目录并打印覆盖率 |

`--activate` 必须精确匹配某个 `--semester` / `--semester-key`；`sync-lessons` 的 `--semester` 接教务系统 `nameZh`（如 `2026年秋季学期`），`build-lessons` 的 `--semester-key` 接短 key（如 `2026-fall`，正则 `^\d{4}-(fall|summer|spring)$`）。

---

## 输出 Schema

### `src/data/curricula.ts` （前端主入口，仿 `icourseRatings.ts`）

```typescript
export interface CurriculumCourse {
  code: string;             // 课程编号，如 "CS1003"
  name: string;
  credits: number;
  compulsory: boolean;
  modulePath: string[];     // 从 moduleTree 根到该课的 type 路径，如 ["通修课程", "计算机通修"]
}
export interface CurriculumRecord {
  id: number;               // 与 curricula 的 key 相同，方便按 id 反查
  sourceUrl?: string;       // 教务系统执行计划查询页（官方页面不支持单方案 URL）
  name: string;             // 培养方案全名
  grade: string;            // "2023"–"2026"
  trainType: string;        // 主修 / 交叉培养 / 科技英才班 / ...
  department: string;
  major: string;
  beginSemester: string | null;
  courseCount: number;
  terms: Record<string, CurriculumCourse[]>;  // "1秋"/"1春"/"2秋"/.../"未指定学期"
}
export const curricula: Record<string, CurriculumRecord> = {
  "3413": {
    "id": 3413,
    "name": "少年班学院培养方案（自动化）",
    "grade": "2026",
    "trainType": "主修",
    "department": "少年班学院",
    "major": "自动化",
    "beginSemester": "2026年秋季学期",
    "courseCount": 99,
    "terms": {
      "1秋": [
        { "code": "CS1003", "name": "计算机程序设计", "credits": 3,
          "compulsory": true, "modulePath": ["通修课程", "计算机通修"] },
        ...
      ],
      "1春": [...],
      ...
    }
  },
  ...
};
```

学期 key 排序：`1秋 < 1春 < 2秋 < 2春 ... < 4秋`；`terms` 字段为 null 的课程归到 `"未指定学期"`。

### `data/index/programs.json`（轻量索引，Python 工具用）

```json
[
  {
    "id": 3413,
    "grade": "2026",
    "trainType": "主修",
    "education": "本科",
    "studentType": "普通",
    "department": "少年班学院",
    "major": "自动化",
    "majorDirection": null,
    "awardDegree": true,
    "beginSemester": "2026年秋季学期",
    "moduleCount": 32,
    "courseCount": 99
  }
]
```

### `data/index/by_program_term.json`（按学期分组，结构同 `curricula.ts.terms`，顶层多 programId 维度）

```json
{
  "3413": {
    "1秋": [
      { "code": "CS1003", "name": "计算机程序设计", "credits": 3,
        "compulsory": true, "modulePath": ["通修课程", "计算机通修"] }
    ],
    "1春": [...],
    ...
  }
}
```

---

## 如何更新数据

```powershell
# 1. 抓取最新 program_tree（含全部 1184 个 program）
uv run python -m catalog_spider fetch-tree

# 2. 增量抓取新 program（断点续爬，只抓缺失的 grade≥2023 program）
uv run python -m catalog_spider fetch-details

# 3. 重生成所有 index
uv run python -m catalog_spider build-index
uv run python -m catalog_spider build-by-term

# 4. 重生成前端 TS
uv run python scripts/curricula_to_ts.py

# 5. 提交
git add -A
git commit -m "data: refresh USTC curricula"
```

如果只想调整爬取范围（不只是 year 限制），改 `catalog_spider/details.py:MIN_GRADE` 后重跑 `fetch-details`（已存在文件不重抓）。

---

## 数据规模

- 494 个 program（grade 2023–2026）
- `data/raw/programs/*.json` ~44 MB
- `data/index/programs.json` ~180 KB
- `data/index/by_program_term.json` ~9 MB
- `src/data/curricula.ts` ~10 MB

---

## 前端接入示例

```typescript
import { curricula, type CurriculumRecord, type CurriculumCourse } from '@/data/curricula';
import { courses } from '@/data/courses';

// 1. 程序选择器
const all: CurriculumRecord[] = Object.values(curricula);  // 494 个
// 渲染：id / name / grade / trainType / department / major

// 2. 选中 program → 展示按学期课程
const program = curricula['3413'];
Object.entries(program.terms).forEach(([term, list]) => {
  // term: "1秋" / "1春" / "2秋" / ...
  // list: CurriculumCourse[]
});

// 3. 把培养方案课程映射到现有 Plan：
//    按 course.code 在 src/data/courses.ts 找 sections
const targetCodes = new Set<string>();
Object.values(program.terms).flat().forEach(c => targetCodes.add(c.code));
const candidates = courses.filter(s => targetCodes.has(s.courseCode));
// 用户从中挑选具体 section 加入 Plan.courseIds
```

---

## 不在范围

- 前端 UI 选课流程（同事实现）
- 教师 / 时间 / 容量等开课字段（培养方案不含，由 `src/data/courses.ts` 提供）

---

## 不动的部分

- `icourse_spider/`（学长遗产）
- `src/` 前端代码（除生成 `curricula.ts`）
- `scripts/excel_to_ts.py` / `scripts/ratings_to_ts.py`
- `pyproject.toml` 的 `[project.dependencies]` 与 `[dependency-groups].spider`（本爬虫复用 `requests` + `tqdm`）
- `.gitignore`（JSON / TS 入 git）
