# catalog_spider

USTC 教务系统培养方案爬虫 + 前端数据生成。

数据源：https://catalog.ustc.edu.cn/plan
- `GET /api/teach/program/tree` — 全量目录（1184 个；本项目只取 grade≥2023 的 494 个）
- `GET /api/teach/program/info/{id}` — 单个培养方案完整数据（递归 moduleTree，含课程清单）

无鉴权；服务器对默认 `python-requests` UA 返回 502，已在 client 内置浏览器 UA。

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

**数据已入 git**（用户明确）：clone 后无需重新抓取，直接跑 `build-index` / `build-by-term` / `curricula_to_ts.py` 即可；只有数据过期需要刷新时才跑 `fetch-tree` / `fetch-details`。

爬取范围：**仅 `grade >= 2023` 的培养方案**（详见 `catalog_spider/details.py:MIN_GRADE`）。

---

## 项目结构

```
catalog_spider/
├── __main__.py            # CLI 入口（5 个子命令）
├── client.py              # HTTP 客户端（10 次重试 + 浏览器 UA）
├── tree.py                # 解析 program_tree.json + filter_by_min_grade
├── details.py             # 8 进程并发抓取 details（断点续爬）
├── process.py             # 从 raw 生成 index（programs.json + by_program_term.json）
├── paths.py               # 数据目录常量 + ensure_dirs()
├── README.md
├── tests/                 # 19 个 pytest 单测
│   ├── test_client.py
│   ├── test_details.py
│   ├── test_process.py
│   ├── test_tree.py
│   └── fixtures/          # 含真实 3413.json（断网也能跑测试）
└── data/
    ├── raw/
    │   ├── program_tree.json
    │   └── programs/{id}.json
    └── index/
        ├── programs.json
        └── by_program_term.json

scripts/curricula_to_ts.py    # 从 index/* 生成 src/data/curricula.ts（前端 import）
```

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
