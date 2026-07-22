# 日常维护指南

本文档面向每学期/平时的数据与代码维护，列出**所有需要手动执行的步骤及其联动点**，避免漏掉「数据更新后前端某处也要跟着改」的情况。

> 环境要求：Node 22+ / pnpm 11+ / uv / Python 3.12+。命令在 PowerShell 下运行。

---

## 速查：什么时候做什么

| 场景 | 频率 | 涉及产物 | 是否需登录 |
|---|---|---|---|
| 更新学期开课与课堂详情 | 每学期开学 + 期中如有调整 | `public/data/semesters/<key>/{courses,updates}.json` + `index.json` | 是（首次） |
| **切换到新学期**（如 2026-fall → 2027-spring） | 每学期一次 | 上面 + 前端 `termCalendar.ts` + 测试 | 是 |
| 更新培养方案 | 每学期开学建议一次 | `src/data/curricula.ts` | 否（培养方案裸爬，但校外可能 401） |
| 更新 icourse 评分 | 新学期开始一次即可 | `src/data/icourseRatings.ts` | 否 |
| 改了代码 / 功能 | 随时 | 跑测试 + lint + build | 否 |

---

## 一、更新学期开课与课堂详情（最频繁）

### 1.1 同步

```powershell
# 首次或依赖变更后
uv sync --group spider --group dev

# 主流程：同步并自动校验
./scripts/sync_semester_courses.ps1 `
  -Semester '2026年秋季学期','2026年夏季学期' `
  -Activate '2026年秋季学期'
```

- `-Semester` 接教务系统 `nameZh`（中文学期名），可传多个；`-Activate` 指定默认学期（必须出现在 `-Semester` 中）。
- 脚本等价于 `uv run --group spider python -m catalog_spider sync-lessons --semester ... --activate ...`，成功后**自动**跑 `validate-lessons --all`。
- 首次运行会打开可见浏览器（优先 Edge，回退 Chromium），需手动登录一次 USTC 统一身份认证；登录态保存在 `catalog_spider/data/browser-profile/`（已 gitignore），后续复用。
- 详情按 50 个课堂一批抓取并写断点到 `catalog_spider/data/raw/lessons/<key>/details.json`；中断后重跑只补缺失的课堂。
- 三个 API：`GET /api/teach/semester/list`、`GET /api/teach/lesson/list-for-teach/{id}`、`POST /api/teach/lesson/infos`（429/5xx 按 1/2/4s 退避重试）。
- **预期输出**（用来判断脚本是否正常推进，登录抓取期间可能数分钟无输出）：
  1. `请在浏览器中完成登录；脚本将等待认证状态。` -- 等你登录，期间无其他输出属正常。
  2. `登录状态: 200` -- 登录成功，开始抓取。
  3. `synced <key>: courses=<N>` -- 该学期课堂列表抓取完成。
  4. `semester=<key> courses=... scheduled_courses=...` -- `validate-lessons` 摘要（字段含义见 1.4）。
  - 登录后脚本自动导航抓取，**无需手动操作页面**；浏览器可保持打开直到脚本退出。

### 1.2 发布产物（均已入 git）

同步成功后，`public/data/semesters/` 下**事务性**写入（中途失败自动回滚）：

```
public/data/semesters/index.json                    # manifest：defaultSemester + 每学期 key/name/file/revision/updatesFile
public/data/semesters/<key>/courses.json            # 课程列表 + detailsBySection + semester.calendar + revision
public/data/semesters/<key>/updates.json            # 变更记录，entries[] 按时间累积
```

- `revision` 是内容哈希（SHA-256，剥离 `generatedAt`/`enrolled` 等易变字段）。内容没变则 `updates.json` 不追加新条目（幂等），重跑不会产生重复更新记录。
- **revision 一致性**（验证时可用）：同一学期的 `index.json` 的 `revision` == `courses.json` 的 `revision` == `updates.json` 的 `currentRevision` == `updates.json` 最新 entry 的 `revision`，四处必须相等。
- `courses.json` 的 `semester.calendar`（含 `holidays`/`makeupDays`）是前端课表渲染节假日/补课的**运行时来源**（`App.tsx` 注入 `CourseTable`）；`src/config/termCalendar.ts` 的 `TERM_CALENDAR` 只是镜像常量 + 测试依赖，见第二节。
- `updates.json` 结构：`{schemaVersion, semesterKey, currentRevision, entries[]}`；每个 entry = `{id, revision, previousRevision, publishedAt, summary{added,removed,modified}, added[], removed[{course, replacementCandidates}], modified[{course, previous, current, changes}]}`，`entry.previousRevision` 指向上一个 entry 的 `revision` 形成链条。
- 前端「最近更新」弹窗、方案对账（被删课堂自动移除并给替换候选、教师/时间/地点变化提示）都依赖 `updates.json`，所以**不要手动删它**。

### 1.3 只改了转换规则 / 校历，不想重新登录抓取

> 前提：`catalog_spider/data/raw/lessons/<key>/` 下已有 raw 数据。**clone 后该目录为空，`build-lessons` 不可用，必须先跑一次 1.1 的 `sync-lessons` 抓取 raw。**

若 raw 已抓全，只调整了解析逻辑或 `CALENDAR_OVERRIDES`，用纯本地重建（不开浏览器、不联网）：

```powershell
uv run python -m catalog_spider build-lessons --semester-key 2026-fall --activate 2026-fall
uv run python -m catalog_spider validate-lessons --all
```

### 1.4 验证

```powershell
uv run python -m catalog_spider validate-lessons --all
```

输出每学期的 `courses` / `raw_schedule_non_empty` / `scheduled_courses` / `clock_time_courses` / `grading_non_empty` / `grading_labels` / `textbooks` / `materials` / `reference_books_non_empty`。

- **`scheduled_courses == raw_schedule_non_empty`** 表示时间表解析零失败；若 `scheduled_courses` 远低于 `raw_schedule_non_empty`，需检查 `lesson_transform.py` 的解析规则。
- **确认本次同步是否真的产生了变更**：对比 `index.json` 中该学期的 `revision` 是否变化，或看 `updates.json` 是否追加了新 entry。`revision` 不变 = 幂等无变更（属正常，不会产生空更新记录）。

---

## 二、切换到新学期（最易漏联动点，务必完整执行）

例如从 `2026-fall` 切到 `2027-spring`。**仅跑 `sync-lessons` 不够**，前端有两处硬编码需同步，否则测试失败、节假日/补课缺失。

### 2.1 后端：加新学期的校历覆盖 + 同步

1. 编辑 `catalog_spider/semester_calendar.py` 的 `CALENDAR_OVERRIDES`，新增学期 key 条目，填 `sourceUrl`（校历官方页）、`holidays`（休）、`makeupDays`（补课，含 `useWeekday`/`useWeek`）。
   - **不加的话**：生成的 `catalog.semester.calendar` 没有节假日/补课，且 `sourceUrl` 回退为默认值。
   - key 必须是 `YYYY-fall`/`YYYY-summer`/`YYYY-spring`，与 `semester_key()` 生成的格式一致。
2. 同步新学期：
   ```powershell
   ./scripts/sync_semester_courses.ps1 -Semester '2027年春季学期' -Activate '2027年春季学期'
   ```
   - `index.json` 的 `defaultSemester` 会自动切到 `-Activate` 指定的学期。
   - 排序规则：年份降序，同年 fall > summer > spring。

### 2.2 前端：同步硬编码校历常量与测试

> 课表日期实际由 `catalog.semester.calendar`（同步时生成）渲染，`App.tsx` 把它传给 `CourseTable`。但 `src/config/termCalendar.ts` 仍保留了一份镜像常量 `TERM_CALENDAR`，且 `src/config/termCalendar.test.ts` 对它有**硬编码断言**——换学期后 `pnpm test` 会在这里失败。

3. 编辑 `src/config/termCalendar.ts`，把 `TERM_CALENDAR` 更新为新学期的 `termId` / `termName` / `termStartDate` / `termEndDate` / `weekStartDate` / `weekCount` / `sourceUrl` / `holidays` / `makeupDays`（与 2.1 的 `CALENDAR_OVERRIDES` 保持一致）。
4. 编辑 `src/config/termCalendar.test.ts`，更新其中硬编码的 `termId` / 日期 / 周范围 / 节假日 / 补课断言，使其匹配新学期。

### 2.3 切换学期检查清单

- [ ] `catalog_spider/semester_calendar.py` `CALENDAR_OVERRIDES` 加了新学期条目
- [ ] `sync-lessons` / `sync_semester_courses.ps1` 同步成功
- [ ] `validate-lessons --all` 通过
- [ ] `public/data/semesters/index.json` 的 `defaultSemester` 已是新学期
- [ ] `src/config/termCalendar.ts` 的 `TERM_CALENDAR` 已更新
- [ ] `src/config/termCalendar.test.ts` 断言已更新
- [ ] `pnpm test` 通过（重点看 `termCalendar.test.ts`）
- [ ] `pnpm build` 通过
- [ ] git 提交（见第六节）

---

## 三、更新培养方案

```powershell
# 抓取 + 建索引（培养方案的 raw/index 不入 git，clone 后需先跑一次）
uv run python -m catalog_spider all          # fetch-tree → fetch-details → build-index → build-by-term

# 生成前端 TS（入 git）
uv run python scripts/curricula_to_ts.py
```

- 爬取范围仅 `grade >= 2023`（`catalog_spider/details.py:MIN_GRADE`）。
- 产物 `src/data/curricula.ts` 入 git；`catalog_spider/data/`（raw/index）不入 git。
- 前端无额外联动：`curricula.ts` 被直接 import，生成后即可用。
- 已抓过且只改转换规则时，可只跑 `build-index` + `build-by-term` + `curricula_to_ts.py`，不必重新抓取。
- 校外裸爬可能 401（见 `catalog_spider/README.md` 鉴权说明），需校内网或已登录态。

---

## 四、更新 icourse 评分

```powershell
# 1. 爬取（8 进程，约数十分钟；输出 icourse_spider/course_rating.json，入 git）
uv run python icourse_spider/spider.py

# 2. 转前端 TS
uv run python scripts/ratings_to_ts.py
```

- 匹配 key：`courseName + '#' + ','.join(sorted(teachers))`，按课堂号（section）维度。
- **注意**：`ratings_to_ts.py` 读取 `src/data/courses.ts`，该文件由历史流程 `scripts/excel_to_ts.py` 从开课 Excel 生成，**当前不维护、不入 git**。除非手头有当学期 Excel，否则一般无需重跑评分转换；新的主数据流是 `catalog_spider sync-lessons` 产出的 `public/data/semesters/*/courses.json`。
- 前端无额外联动：`src/data/icourseRatings.ts` 被直接查表使用。

---

## 五、改代码 / 新增功能后

```powershell
pnpm tsc -b          # 类型检查
pnpm lint            # oxlint
pnpm test            # Vitest（或 pnpm test:watch 监听）
pnpm build           # 生产构建
uv run pytest catalog_spider/tests -v   # 若改了爬虫/转换逻辑
```

- **新增用户可感知的功能时**，同步在 `src/updates/appUpdates.ts` 的 `APP_RELEASES` 追加一条版本记录（`version` 用 `YYYY.MM.DD.N`，保持最旧到最新顺序）。这是站内「最近更新」弹窗的版本日志来源。
- 纯数据更新（仅跑 sync）**不需要**改 `APP_RELEASES`——课程增删改由 `updates.json` 自动驱动，与版本日志是两套机制。

---

## 六、提交

当前项目用功能分支 + PR 合并到 `main`，不直接在 `main` 上提交。

```powershell
git checkout -b <分支名>      # 如 data/refresh-2026-fall、docs/maintenance
git add -A
git commit -m "<type>: <subject>"   # type 用 data / docs / feat / fix / chore 等
git push -u origin <分支名>
gh pr create --title "..." --body "..."
```

- 数据更新建议用 `data:` 前缀，如 `data: refresh 2026-fall lessons`。
- 切换学期这类含前端联动的，一次提交涵盖后端数据 + `termCalendar.ts` + 测试，便于回溯。
- **PR 合并后清理**（在 GitHub 上合并后，本地执行）：
  ```powershell
  git checkout main
  git branch -D <分支名>      # 删本地分支
  git pull origin main        # 拉取合并后的 main
  ```

---

## 七、常见问题

**Q: `pnpm test` 在 `termCalendar.test.ts` 失败？**
A: 换学期后没同步更新 `src/config/termCalendar.ts` 的 `TERM_CALENDAR` 常量与该测试的硬编码断言。见第二节。

**Q: 课表不显示节假日/补课？**
A: `catalog_spider/semester_calendar.py` 的 `CALENDAR_OVERRIDES` 没有该学期条目，或加了之后没重新 `sync-lessons` / `build-lessons`。

**Q: `sync-lessons` 报 401？**
A: USTC CAS/SSO 登录态过期。删除 `catalog_spider/data/browser-profile/` 后重跑，重新手动登录。校外需先连校内网或 VPN。

**Q: 重跑 sync 后「最近更新」弹窗没有变化？**
A: 内容哈希 `revision` 未变（幂等），`updates.json` 不追加新条目，属正常。若确实有变化却没记录，检查 `course_updates.py` 的 diff 逻辑。

**Q: `validate-lessons` 显示 `scheduled_courses` 偏低？**
A: 时间表解析失败率高。看 `lesson_transform.py` 的 `_schedule_slots` 是否覆盖了新的时间字符串格式，并用 `raw_schedule_non_empty` 对照排查。

**Q: `ratings_to_ts.py` 报「找不到 src/data/courses.ts」？**
A: 这是历史流程依赖，当前主数据流已改为 `public/data/semesters/*/courses.json`。除非有当学期 Excel 走 `excel_to_ts.py`，否则跳过评分转换。

---

## 参考

- 项目总览与设计决策：[`README.md`](README.md)
- 爬虫 CLI、schema、鉴权细节：[`catalog_spider/README.md`](catalog_spider/README.md)
- 站内版本日志源：`src/updates/appUpdates.ts`（`APP_RELEASES`）
- 校历覆盖源：`catalog_spider/semester_calendar.py`（`CALENDAR_OVERRIDES`）
- 前端校历镜像与测试：`src/config/termCalendar.ts` + `src/config/termCalendar.test.ts`
