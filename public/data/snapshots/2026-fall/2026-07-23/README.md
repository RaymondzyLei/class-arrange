# 2026-fall 课程数据快照 · 2026-07-23

本目录是 2026 年秋季学期课程数据在 **2026-07-23** 的封存快照，代表一个特殊时间点的开课数量基准。

**不会被 `catalog_spider sync-lessons` 覆盖**--该命令只写 `public/data/semesters/`，本目录隔离于同步流程之外，内容固定不变。

## 元数据

| 字段 | 值 |
|---|---|
| 学期 | `2026-fall`（2026年秋季学期） |
| 封存日期 | 2026-07-23 |
| `revision` | `5e6c9cdd284a5ba55121e81d4e2b2f9e59467cdaf70e5d34b06528b6654c5042` |
| 来源文件 | `public/data/semesters/2026-fall/courses.json` |
| 来源提交 | `00de591`（PR #29 合并后的 main） |

## 数量指标（来自 `validate-lessons`）

| 指标 | 值 |
|---|---|
| `courses` | 2466 |
| `raw_schedule_non_empty` | 2351 |
| `scheduled_courses` | 2351（= `raw_schedule_non_empty`，时间表解析零失败） |
| `clock_time_courses` | 91 |
| `grading_non_empty` | 2466 |
| `grading_labels` | 二分制,五分制,百分制 |
| `textbooks` | 2264 |
| `materials` | 180 |
| `reference_books_non_empty` | 2424 |

## 说明

- 此快照用于固化该时间点的课程数量，不随后续数据刷新而变化。
- 主数据流仍为 `public/data/semesters/2026-fall/courses.json`，会随 `sync-lessons` 持续更新；本快照不参与该流程。
- 如需对比当前数据与本快照的差异，可 diff 两份 `courses.json`，或比较当前 `index.json` 的 `revision` 与上表的 `revision`。
- 同目录下的 `courses.json` 是来源文件的逐字节副本，未做任何改动。
