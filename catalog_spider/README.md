# catalog_spider

USTC 教务系统培养方案爬虫 + 数据整理。

数据源：https://catalog.ustc.edu.cn/plan
提供两个 API：
- `GET /api/teach/program/tree` — 全量培养方案目录（1184 个）
- `GET /api/teach/program/info/{id}` — 单个培养方案完整数据

无鉴权、无反爬；服务器对默认 `python-requests` UA 返回 502，已在 client 内置浏览器 UA。

---

## 用法

```powershell
# 安装依赖
uv sync --group spider --group dev

# 按顺序跑完 4 步（首次）
uv run python -m catalog_spider all

# 或分步
uv run python -m catalog_spider fetch-tree        # 抓 program_tree（秒级）
uv run python -m catalog_spider fetch-details     # 抓 ~840 个 program 详情（断点续爬，~3 分钟）
uv run python -m catalog_spider build-index       # 生成索引
uv run python -m catalog_spider build-by-term     # 生成按学期分组

# 测试
uv run pytest catalog_spider/tests -v
```

爬取范围：**仅 `grade >= 2023` 的培养方案**（避免 JSON 总量过大；调整见 `catalog_spider/details.py:MIN_GRADE`）。

---

## 输出结构

```
catalog_spider/
├── data/
│   ├── raw/
│   │   ├── program_tree.json           # 1 个，全量目录
│   │   └── programs/{id}.json          # 494 个，单个 program 详情
│   └── index/
│       ├── programs.json               # 1 个，494 行索引
│       └── by_program_term.json        # 1 个，按 program × term 分组
```

**所有 JSON 入 git**（用户明确）：clone 后无需重新爬取即可使用索引；如需更新数据再跑 `all`。

---

## 前端消费：src/data/curricula.ts

仿 `src/data/icourseRatings.ts` 风格，由 `scripts/curricula_to_ts.py` 生成。

```powershell
uv run python scripts/curricula_to_ts.py
```

输出 `src/data/curricula.ts`，前端可直接 `import { curricula } from './curricula'` 使用。
类型定义：

```typescript
export interface CurriculumCourse {
  code: string;          // 课程编号，如 "CS1003"
  name: string;
  credits: number;
  compulsory: boolean;
  modulePath: string[];  // e.g. ["通修课程", "计算机通修"]
}
export interface CurriculumRecord {
  id: number;            // program id（与 curricula key 相同，方便按 id 查）
  name: string;          // 培养方案名称
  grade: string;
  trainType: string;
  department: string;
  major: string;
  beginSemester: string | null;
  courseCount: number;
  terms: Record<string, CurriculumCourse[]>;  // "1秋"/"1春"/"2秋"/.../"未指定学期"
}
export const curricula: Record<string, CurriculumRecord> = { ... };
```

---

## 输出 Schema

### `index/programs.json`

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

### `index/by_program_term.json`

```json
{
  "3413": {
    "1秋": [
      {
        "code": "CS1003",
        "name": "计算机程序设计",
        "credits": 3,
        "compulsory": true,
        "modulePath": ["通修课程", "计算机通修"]
      }
    ],
    "1春": [...],
    "2秋": [...]
  }
}
```

- `modulePath` = 从 moduleTree 根到含此课程的叶子节点的 `type` 字段列表（用户角色路径）
- 学期 key 按 `1秋 < 1春 < 2秋 < 2春 ...` 排序
- `terms` 为 null 的课程归到 `"未指定学期"`

---

## 数据规模

- 494 个 program（grade 2023–2026）
- `data/raw/programs/*.json` ~44 MB
- `data/index/programs.json` ~180 KB
- `data/index/by_program_term.json` ~9 MB
- `src/data/curricula.ts` ~10 MB

---

## 不在范围

- 前端导入培养方案的逻辑（同事改前端时再做；`Plan.courseIds` 字段为 section id，需要 join 到 `src/data/courses.ts`）
- 教师/时间/容量等开课字段（培养方案不包含这些，由现有 `src/data/courses.ts` 提供）

---

## 不动的部分

- `icourse_spider/`（学长遗产）
- `src/` 前端代码
- `scripts/excel_to_ts.py` / `scripts/ratings_to_ts.py`
- `pyproject.toml` 的 `[project.dependencies]` 与 `[dependency-groups].spider`（本爬虫直接复用 `requests` + `tqdm`）
- `.gitignore`（JSON 入 git，不忽略）