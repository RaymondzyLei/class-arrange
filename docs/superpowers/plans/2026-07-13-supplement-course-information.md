# Supplement Course Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single generated TypeScript course array with reusable authenticated per-semester catalog exports, load only the selected semester in the frontend, isolate plans by semester, and expose grading/textbook/reference information.

**Architecture:** A visible Playwright browser shares the user's CAS session with same-origin API requests, checkpoints raw responses, validates complete detail coverage, and atomically generates one deployable JSON file per semester plus a small manifest. A React catalog provider loads the manifest and exactly one semester file, derives all indices/options from that file, and remounts the plans provider with a semester-scoped storage key.

**Tech Stack:** Python 3.12+, Playwright for Python, pytest, React 19, TypeScript 6, Ant Design 6, Vitest, Vite 8.

## Global Constraints

- Branch name is exactly `supplement-course-information`.
- Default semester is `2026-fall`; this delivery also includes `2026-summer`.
- Each semester has exactly one deployable `public/data/semesters/<key>/courses.json` containing both `courses` and `detailsBySection`.
- The frontend fetches `index.json` plus only the selected semester's `courses.json`; it does not eagerly prefetch other semester data.
- Plans are stored under `class-arrange:v2:plans:<semester-key>` and never cross semester boundaries.
- Preserve the existing semester-title text style; add only an adjacent icon button and reuse `ChevronIcon`, `.select-chevron`, `.select-chevron--open`, and Ant Design dropdown motion.
- `grading` is an open string sourced from `lesson/infos`; do not hard-code a grading enum.
- Grading appears beside assessment method; textbooks/materials and reference books appear in the detail table.
- English name, descriptions, prerequisites, syllabus, and all known detail fields remain in JSON even when hidden in the UI.
- The scraper never reads, prints, or writes credentials/Cookie values. Its persistent browser profile and raw checkpoints are Git-ignored.
- Production code follows red-green-refactor: every new behavior receives a failing test before implementation.
- Preserve the user's pre-existing untracked `.codex-temp/` directory.

---

### Task 1: Define and Transform the Semester Catalog Schema

**Files:**
- Create: `catalog_spider/lesson_transform.py`
- Create: `catalog_spider/semester_calendar.py`
- Create: `catalog_spider/tests/fixtures/lesson_list_mini.json`
- Create: `catalog_spider/tests/fixtures/lesson_details_mini.json`
- Create: `catalog_spider/tests/test_lesson_transform.py`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: raw semester objects, `list-for-teach` arrays, and `lesson/infos` arrays.
- Produces: `semester_key(name_zh: str) -> str`, `build_semester_catalog(semester, lessons, details_by_code, calendar_overrides) -> dict`, and `validate_semester_catalog(catalog) -> None`.
- Produces TypeScript contracts `SemesterCatalog`, `SemesterManifest`, `SemesterManifestEntry`, `CourseDetail`, and `CourseTextbook`.

- [ ] **Step 1: Add representative raw fixtures**

Use two lesson records with exact upstream keys: `course`, `openDepartment`, `teacherAssignmentList`, `dateTimePlaceText`, `credits`, `period`, `education`, `classType`, `courseClassify`, `courseType`, `teachLang`, `examMode`, `graduateAndPostgraduat`, `stdCount`, `limitCount`, and `adminClasses`. Use detail records containing one published textbook, one `publish=false` material, `grading="百分制"`, English name, Chinese/English description, prerequisite, reference text, and syllabus.

- [ ] **Step 2: Write failing transformation tests**

```python
def test_semester_key_supports_three_ustc_terms():
    assert semester_key("2026年秋季学期") == "2026-fall"
    assert semester_key("2026年夏季学期") == "2026-summer"
    assert semester_key("2027年春季学期") == "2027-spring"


def test_build_catalog_keeps_complete_details(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    assert catalog["courses"][0]["grading"] == "百分制"
    detail = catalog["detailsBySection"]["001108.01"]
    assert detail["name"]["en"] == "Mathematical Experiment"
    assert detail["textbooks"][0]["publish"] is True
    assert detail["materials"][0]["publish"] is False
    assert detail["referenceBooks"] == "Reference text"
    assert detail["description"]["en"] == "English description"


def test_validate_catalog_rejects_missing_detail(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    del catalog["detailsBySection"]["001108.01"]
    with pytest.raises(ValueError, match="missing details"):
        validate_semester_catalog(catalog)
```

- [ ] **Step 3: Run tests and verify RED**

Run: `uv run pytest catalog_spider/tests/test_lesson_transform.py -q`

Expected: collection fails because `catalog_spider.lesson_transform` does not exist.

- [ ] **Step 4: Implement normalization and validation**

Implement these exact public functions:

```python
TERM_NAMES = {"春季": "spring", "夏季": "summer", "秋季": "fall"}


def semester_key(name_zh: str) -> str:
    match = re.fullmatch(r"(\d{4})年(春季|夏季|秋季)学期", name_zh.strip())
    if not match:
        raise ValueError(f"unsupported semester name: {name_zh}")
    return f"{match.group(1)}-{TERM_NAMES[match.group(2)]}"


def build_semester_catalog(
    semester: dict,
    lessons: list[dict],
    details_by_code: dict[str, dict],
    calendar_overrides: dict[str, dict],
) -> dict:
    """Return schemaVersion=1 catalog sorted by classroom code."""


def validate_semester_catalog(catalog: dict) -> None:
    """Raise ValueError on duplicate course ids, missing/extra details, or grading mismatch."""
```

Normalize `None` to empty strings, treat English name `"1"` as empty, preserve every known detail field, derive `materials` from `textbooks` entries whose `publish` is false, and parse `dateTimePlaceText` into the existing `ScheduleSlot[]` contract.

- [ ] **Step 5: Add the calendar override merger**

```python
def build_term_calendar(semester: dict, key: str, override: dict | None) -> dict:
    start = date.fromisoformat(semester["start"])
    end = date.fromisoformat(semester["end"])
    return {
        "termId": key,
        "termName": semester["nameZh"],
        "weekStartDate": start.isoformat(),
        "weekCount": math.ceil(((end - start).days + 1) / 7),
        "sourceUrl": (override or {}).get("sourceUrl", "https://catalog.ustc.edu.cn/query/lesson"),
        "holidays": (override or {}).get("holidays", {}),
        "makeupDays": (override or {}).get("makeupDays", {}),
    }
```

Move the existing 2026 autumn holiday/makeup values into a Python constant keyed by `2026-fall`; use an empty override for `2026-summer`.

- [ ] **Step 6: Add matching TypeScript types**

Extend `CourseSection` with `grading: string`, extend `FilterState` with `grading: string`, and add exact JSON contracts matching the design document. `CourseDetail.syllabus` must accept `unknown` because the upstream field is not guaranteed to be a string.

- [ ] **Step 7: Run transformer tests and existing frontend tests**

Run: `uv run pytest catalog_spider/tests/test_lesson_transform.py -q`

Expected: all transformer tests pass.

Run: `pnpm test`

Expected: the suite fails only at call sites that construct `CourseSection` or `FilterState` without the new required `grading` property; update test fixtures, not production behavior, then rerun until green.

- [ ] **Step 8: Commit**

```powershell
git add catalog_spider/lesson_transform.py catalog_spider/semester_calendar.py catalog_spider/tests src/types/index.ts
git commit -m "feat: define semester catalog schema"
```

---

### Task 2: Build the Authenticated, Resumable Lesson Sync Command

**Files:**
- Create: `catalog_spider/lesson_sync.py`
- Create: `catalog_spider/tests/test_lesson_sync.py`
- Modify: `catalog_spider/__main__.py`
- Modify: `catalog_spider/paths.py`
- Modify: `pyproject.toml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1 transformation functions.
- Produces: repeatable CLIs `python -m catalog_spider sync-lessons --semester NAME [--semester NAME...] [--activate NAME]` and `python -m catalog_spider validate-lessons [--all | --semester-key KEY]`.
- Produces: `batch_codes`, `merge_detail_batch`, `build_manifest`, `write_json_atomic`, and `sync_requested_semesters` pure/testable helpers.

- [ ] **Step 1: Write failing batching, resume, and manifest tests**

```python
def test_batch_codes_uses_fifty_items():
    codes = [f"C{i:03}.01" for i in range(101)]
    assert [len(batch) for batch in batch_codes(codes)] == [50, 50, 1]


def test_missing_codes_excludes_checkpointed_details():
    assert missing_codes(["A.01", "B.01"], {"A.01": {"code": "A.01"}}) == ["B.01"]


def test_build_manifest_replaces_entry_without_dropping_other_terms():
    current = {
        "schemaVersion": 1,
        "defaultSemester": "2026-fall",
        "semesters": [{"key": "2026-fall", "name": "2026年秋季学期", "file": "2026-fall/courses.json"}],
    }
    result = build_manifest(current, "2026-summer", "2026年夏季学期", activate=False)
    assert [entry["key"] for entry in result["semesters"]] == ["2026-fall", "2026-summer"]
    assert result["defaultSemester"] == "2026-fall"
```

- [ ] **Step 2: Run sync tests and verify RED**

Run: `uv run pytest catalog_spider/tests/test_lesson_sync.py -q`

Expected: collection fails because `catalog_spider.lesson_sync` does not exist.

- [ ] **Step 3: Implement filesystem and pure sync helpers**

```python
DETAIL_BATCH_SIZE = 50


def batch_codes(codes: list[str], size: int = DETAIL_BATCH_SIZE) -> list[list[str]]:
    return [codes[index:index + size] for index in range(0, len(codes), size)]


def missing_codes(codes: list[str], details_by_code: dict[str, dict]) -> list[str]:
    return [code for code in codes if code not in details_by_code]


def write_json_atomic(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
```

Sort manifest entries by parsed year and term order `fall > summer > spring` within the same year. Do not modify `defaultSemester` unless `activate=True`.

- [ ] **Step 4: Add visible-browser authentication and API transport**

Add Playwright to the `spider` dependency group. Launch a persistent context at `catalog_spider/data/browser-profile`, preferring installed Microsoft Edge via `channel="msedge"`, with `headless=False`. Navigate to `/query/lesson`, poll `/api/teach/semester/list` through `context.request` for up to ten minutes, and print only login guidance and status codes.

The transport methods are:

```python
def api_get(request, path: str) -> object:
    response = request.get(BASE_URL + path, timeout=30_000)
    if not response.ok:
        raise SyncError(f"GET {path} returned {response.status}")
    return response.json()


def api_post_json(request, path: str, payload: dict) -> object:
    response = request.post(BASE_URL + path, data=payload, timeout=30_000)
    if not response.ok:
        raise SyncError(f"POST {path} returned {response.status}")
    return response.json()
```

Retry detail batches three times with delays of 1, 2, and 4 seconds for 429 and 5xx responses. Do not retry schema/validation errors.

- [ ] **Step 5: Wire checkpointing and safe publication**

For each requested semester write:

```text
catalog_spider/data/raw/lessons/<key>/semester.json
catalog_spider/data/raw/lessons/<key>/lessons.json
catalog_spider/data/raw/lessons/<key>/details.json
```

After every successful detail batch atomically update `details.json`. Publish `public/data/semesters/<key>/courses.json` only after `validate_semester_catalog` confirms full coverage. Then atomically update `public/data/semesters/index.json`.

- [ ] **Step 6: Add CLI arguments**

```python
sync = cmds.add_parser("sync-lessons", help="登录后同步指定学期开课和课堂详情")
sync.add_argument("--semester", action="append", required=True, dest="semesters")
sync.add_argument("--activate")
sync.add_argument("--profile-dir", type=Path)

validate = cmds.add_parser("validate-lessons", help="校验已生成的学期开课文件")
target = validate.add_mutually_exclusive_group(required=True)
target.add_argument("--all", action="store_true")
target.add_argument("--semester-key")
```

Reject `--activate` when its exact label is not one of the requested semester labels. `validate-lessons` loads deployable JSON, calls `validate_semester_catalog`, and prints course count, non-empty grading count and labels, structured textbook/material count, and non-empty reference-book count.

- [ ] **Step 7: Ignore authentication and raw checkpoint state**

Add these exact entries:

```gitignore
# Catalog login profile and resumable raw lesson responses
catalog_spider/data/browser-profile/
catalog_spider/data/raw/lessons/
```

- [ ] **Step 8: Run tests and commit**

Run: `uv run pytest catalog_spider/tests/test_lesson_sync.py catalog_spider/tests/test_lesson_transform.py -q`

Expected: all tests pass without opening a browser because browser transport is injected/faked at the orchestration boundary.

```powershell
git add catalog_spider pyproject.toml uv.lock .gitignore
git commit -m "feat: add authenticated lesson sync command"
```

---

### Task 3: Add the Runtime Semester Catalog Loader

**Files:**
- Create: `src/data/semesterCatalog.ts`
- Create: `src/data/semesterCatalog.test.ts`
- Create: `src/data/SemesterCatalogContext.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `public/data/semesters/index.json` and selected `courses.json`.
- Produces: `selectInitialSemester(manifest, storedKey)`, `loadSemesterManifest(fetcher, signal)`, `loadSemesterCatalog(entry, fetcher, signal)`, and `useSemesterCatalog()`.
- Context exposes `{ manifest, catalog, courses, courseMap, groups, groupByKey, groupsByCode, filterOptions, status, switchSemester }`.

- [ ] **Step 1: Write failing loader-selection tests**

```typescript
test('uses persisted semester when it exists in the manifest', () => {
  expect(selectInitialSemester(manifest, '2026-summer')).toBe('2026-summer');
});

test('falls back to default when persisted semester is missing', () => {
  expect(selectInitialSemester(manifest, '2025-fall')).toBe('2026-fall');
});

test('builds a public-base-aware course URL', () => {
  expect(getSemesterCatalogUrl('/class-arrange/', manifest.semesters[1]))
    .toBe('/class-arrange/data/semesters/2026-summer/courses.json');
});
```

- [ ] **Step 2: Run loader tests and verify RED**

Run: `pnpm test -- src/data/semesterCatalog.test.ts`

Expected: test fails because the module does not exist.

- [ ] **Step 3: Implement pure parsing and URL helpers**

Use `import.meta.env.BASE_URL` for GitHub Pages compatibility. Throw `SemesterCatalogError` for non-2xx responses, unsupported `schemaVersion`, duplicate semester keys, missing default, duplicate course ids, or details coverage mismatch.

```typescript
export const SEMESTER_SELECTION_KEY = 'class-arrange:v1:selected-semester';

export function selectInitialSemester(manifest: SemesterManifest, storedKey: string | null): string {
  if (storedKey && manifest.semesters.some((entry) => entry.key === storedKey)) return storedKey;
  return manifest.defaultSemester;
}
```

- [ ] **Step 4: Implement the provider's atomic switch**

Keep the previous `catalog` while the target fetch is pending. Abort a prior pending request before starting another. Only set `selectedSemesterKey`, persist it, and replace derived data after the new catalog validates. On error keep the previous catalog and expose a Chinese error string for an Ant Design message.

Build `courseMap`, `groups`, `groupByKey`, and filter-option arrays with `useMemo` from `catalog.courses`; do not use module-level caches.

- [ ] **Step 5: Put the catalog provider above the application**

Render the catalog loading/error shell before the application. At this task boundary, keep the existing plans provider API unchanged; Task 4 will scope and key it after its storage tests exist. The root tree must be:

```tsx
<SemesterCatalogProvider>
  <App />
</SemesterCatalogProvider>
```

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test -- src/data/semesterCatalog.test.ts`

Expected: all loader tests pass.

```powershell
git add src/data/semesterCatalog.ts src/data/semesterCatalog.test.ts src/data/SemesterCatalogContext.tsx src/main.tsx src/App.tsx
git commit -m "feat: load one semester catalog at runtime"
```

---

### Task 4: Isolate Plans and Remove Static Course Caches

**Files:**
- Modify: `src/utils/planSeed.ts`
- Create: `src/utils/planSeed.test.ts`
- Modify: `src/store/plansContext.tsx`
- Modify: `src/utils/courseGroup.ts`
- Modify: `src/hooks/useFilteredCourses.ts`
- Modify: `src/constants/filterOptions.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/CoursePool.tsx`
- Modify: `src/components/SelectedCoursesModal.tsx`
- Delete: `src/data/index.ts`
- Delete: `src/data/courses.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `semesterKey` and catalog-derived arrays/maps from Task 3.
- Produces: `plansStorageKey(semesterKey)`, `loadPlansState(semesterKey, options)`, `savePlansState(semesterKey, state)`, and `filterCourses(courses, filter)`.

- [ ] **Step 1: Write failing plan-key and migration tests**

```typescript
test('builds a distinct key for every semester', () => {
  expect(plansStorageKey('2026-fall')).toBe('class-arrange:v2:plans:2026-fall');
  expect(plansStorageKey('2026-summer')).toBe('class-arrange:v2:plans:2026-summer');
});

test('only default semester migrates the v1 plan payload', () => {
  storage.setItem('class-arrange:v1:plans', JSON.stringify(legacyPayload));
  expect(loadPlansState('2026-fall', { defaultSemester: '2026-fall', storage }))
    .toEqual(legacyPayload.state);
  expect(loadPlansState('2026-summer', { defaultSemester: '2026-fall', storage }))
    .toBeNull();
});
```

- [ ] **Step 2: Run plan tests and verify RED**

Run: `pnpm test -- src/utils/planSeed.test.ts`

Expected: compile/test failure because semester-aware APIs do not exist.

- [ ] **Step 3: Implement namespaced persistence**

`PlansProvider` receives `semesterKey`, `defaultSemesterKey`, and `validCourseIds`. Its reducer initializer reads only that key and sanitizes missing classroom ids. Inside `App`, call `useSemesterCatalog()` and render the term-scoped subtree as:

```tsx
<PlansProvider
  key={catalog.semester.key}
  semesterKey={catalog.semester.key}
  defaultSemesterKey={manifest.defaultSemester}
  validCourseIds={new Set(courseMap.keys())}
>
  <MainArea themeMode={themeMode} onToggleTheme={toggleTheme} />
</PlansProvider>
```

The key remounts the reducer before the storage namespace changes, preventing old-term state from entering a new key. Preserve the debounce, but keep `latestStateRef` and synchronously call `savePlansState(semesterKey, latestStateRef.current)` during provider unmount; otherwise a course change made less than 200ms before switching terms is lost when cleanup cancels the timer.

If v2 is absent for the default semester, read v1 once, validate, save to v2, and set `class-arrange:v2:plans-migrated` to `"1"`. Never remove the v1 key automatically.

- [ ] **Step 4: Write failing grading filter tests**

```typescript
test('filters the supplied semester courses by grading', () => {
  const filter = { ...EMPTY_FILTER, grading: '五分制' };
  expect(filterCourses([percentageCourse, fiveLevelCourse], filter).map((course) => course.id))
    .toEqual([fiveLevelCourse.id]);
});
```

- [ ] **Step 5: Remove static imports and caches**

Make `useFilteredCourses(courses, groups, filter)` consume context data. Replace `getCourseById` with `courseMap.get`, and replace `getAllCourseGroupsByKey()` with context `groupByKey`. Pass the dataset map into `CoursePool` instead of its static import. Replace the empty-dependency `useMemo` in `SelectedCoursesModal` with `groupsByCode` from the current dataset so a term switch cannot retain old groups. Convert `filterOptions.ts` into:

```typescript
export interface CourseFilterOptions {
  departments: string[];
  courseTypes: string[];
  sectionTypes: string[];
  examTypes: string[];
  gradings: string[];
  languages: string[];
}

export function buildCourseFilterOptions(courses: CourseSection[]): CourseFilterOptions;
```

Delete the generated `courses.ts` and its manual chunk rule only after `rg "@/data|data/courses|getAllCourseGroups" src` confirms no static dataset imports remain. Keep `scripts/excel_to_ts.py` as a documented legacy tool; adjust its output documentation so it no longer claims to be the primary source.

- [ ] **Step 6: Run tests, build, and commit**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm build`

Expected: successful TypeScript/Vite build with no `courses-*.js` static data chunk.

```powershell
git add src scripts/excel_to_ts.py vite.config.ts
git commit -m "refactor: scope courses and plans by semester"
```

---

### Task 5: Add the Semester Dropdown to the Timetable Header

**Files:**
- Create: `src/components/SemesterDropdown.tsx`
- Modify: `src/components/CourseTable.tsx`
- Modify: `src/App.tsx`
- Modify: `src/config/termCalendar.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: manifest entries, current semester, catalog calendar, loading state, and `switchSemester`.
- Produces: accessible icon-triggered semester menu adjacent to the unchanged term-name text.

- [ ] **Step 1: Refactor calendar utilities and timetable functions to require a dynamic calendar**

Remove the hard-coded `TERM_CALENDAR` export. Require a `calendar` argument for `getTermEndDate`, `getWeekRange`, `formatDateRange`, `getWeekNumberForISO`, `getCalendarDatesForSelection`, `getWeekOptions`, and `getSpecialDateSummaries`. Add `calendar: TermCalendar` to `CourseTable`, `TimetableView`, and the internal `buildEntries` call chain. Pass it to every calendar utility, set the slider max to `calendar.weekCount`, and include `calendar` in every memo dependency that derives dates/options.

- [ ] **Step 2: Implement the controlled dropdown**

```tsx
<Dropdown
  menu={{ items, selectedKeys: [semesterKey], onClick: handleSelect }}
  trigger={['click']}
  open={open}
  onOpenChange={setOpen}
  disabled={loading}
>
  <Button
    type="text"
    className="course-table__semester-toggle"
    aria-label="选择学期"
    aria-expanded={open}
  >
    <ChevronIcon className={`select-chevron${open ? ' select-chevron--open' : ''}`} />
  </Button>
</Dropdown>
```

Wrap the term text and button in `.course-table__term-selector`. Keep `.course-table__term-name` font, weight, color, and nowrap declarations unchanged.

- [ ] **Step 3: Add focused responsive styles**

Use the existing icon-button dimensions and hover/focus variables. Ensure the new selector fits existing 880px/650px/480px container queries without changing the title's typography. Honor the existing reduced-motion override for `.select-chevron`.

- [ ] **Step 4: Verify dynamic calendar tests and build**

Extend `src/config/termCalendar.test.ts` with a four-week summer calendar and assert `getWeekOptions(summer).length === 5` and `formatDateRange('all', summer)` uses summer dates.

Run: `pnpm test -- src/config/termCalendar.test.ts`

Expected: all calendar tests pass.

Run: `pnpm build`

Expected: build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add src/components/SemesterDropdown.tsx src/components/CourseTable.tsx src/App.tsx src/index.css src/config/termCalendar.test.ts
git commit -m "feat: add semester picker to timetable"
```

---

### Task 6: Expose Grading, Textbooks, and Reference Books

**Files:**
- Create: `src/utils/courseDetails.ts`
- Create: `src/utils/courseDetails.test.ts`
- Modify: `src/components/FilterBar.tsx`
- Modify: `src/components/CourseDetailModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `detailsBySection`, current filter options, and representative section id.
- Produces: `formatCourseMaterials(detail) -> { textbooks: string[]; materials: string[]; legacy: string }` and new grading filter control.

- [ ] **Step 1: Write failing material formatting tests**

```typescript
test('formats structured textbooks and separates materials', () => {
  const result = formatCourseMaterials(detailWithBookAndMaterial);
  expect(result.textbooks).toEqual(['教材名（第2版）· 作者 · 出版社 · ISBN 123']);
  expect(result.materials).toEqual(['课程讲义 · 教师']);
  expect(result.legacy).toBe('');
});

test('falls back to legacy textbook only without structured entries', () => {
  expect(formatCourseMaterials(detailWithLegacyOnly).legacy).toBe('旧版教材文本');
});
```

- [ ] **Step 2: Run detail utility tests and verify RED**

Run: `pnpm test -- src/utils/courseDetails.test.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement grading filter UI**

Add `grading: ''` to `EMPTY_FILTER`. Pass context filter options into `FilterBar` and add a `SelectWithChevron` with placeholder `评分制`, options `filterOptions.gradings`, and `update({ grading: value ?? '' })`. Keep the checkbox after all select controls.

- [ ] **Step 4: Implement detail presentation**

Lookup the representative detail with `detailsBySection[rep.id]`. In desktop `Descriptions`, render the assessment row exactly as:

```tsx
<Descriptions.Item label="考核方式">{displayValue(rep.examType)}</Descriptions.Item>
<Descriptions.Item label="评分制">{displayValue(rep.grading)}</Descriptions.Item>
```

Add full-width `教材 / 讲义` and `参考书` items. On mobile, put assessment and grading in one existing `mobile-field--pair`, then add wrapping single-column fields for materials and references. Use `—` for empty strings.

Store but do not render English name, descriptions, prerequisite, and syllabus.

- [ ] **Step 5: Run unit tests and build**

Run: `pnpm test`

Expected: all tests pass, including grading filter and material formatting.

Run: `pnpm build`

Expected: build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add src/utils/courseDetails.ts src/utils/courseDetails.test.ts src/components/FilterBar.tsx src/components/CourseDetailModal.tsx src/App.tsx src/index.css
git commit -m "feat: show grading and course materials"
```

---

### Task 7: Fetch and Publish 2026 Autumn and Summer Data

**Files:**
- Create: `public/data/semesters/index.json`
- Create: `public/data/semesters/2026-fall/courses.json`
- Create: `public/data/semesters/2026-summer/courses.json`

**Interfaces:**
- Consumes: Task 2 CLI and the user's interactive CAS login.
- Produces: two validated deployable semester files and default manifest.

- [ ] **Step 1: Install the browser runtime dependency**

Run: `uv sync --group spider`

Expected: Playwright Python package is installed and `uv.lock` is current.

Prefer installed Edge. If Playwright reports that no browser executable is available, run `uv run --group spider playwright install chromium` and rerun the sync command.

- [ ] **Step 2: Run the two-semester sync**

Run:

```powershell
uv run --group spider python -m catalog_spider sync-lessons `
  --semester "2026年秋季学期" `
  --semester "2026年夏季学期" `
  --activate "2026年秋季学期"
```

Expected after user login: the command prints exact semester ids/counts, reaches 100% detail coverage for each term, writes two catalog files, and reports `2026-fall` as active. The observed summer list count must be 90 unless the upstream site changed; if it changed, record the fresh API count rather than forcing 90.

- [ ] **Step 3: Validate generated files independently**

Run: `uv run --group spider python -m catalog_spider validate-lessons --all`

Expected: two files valid, no duplicate classroom ids, no missing/extra details, and grading in each course matches its detail record.

Run a short statistics command exposed by `validate-lessons` and record course counts, non-empty grading counts, grading labels, textbook counts, and reference-book counts in the command output.

- [ ] **Step 4: Commit generated data**

```powershell
git add public/data/semesters
git commit -m "data: add 2026 autumn and summer catalogs"
```

---

### Task 8: Documentation, Full Verification, and Browser QA

**Files:**
- Modify: `README.md`
- Modify: `catalog_spider/README.md`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: documented one-command semester workflow and CI coverage for frontend tests plus Python transformation tests.

- [ ] **Step 1: Document the new recurring workflow**

Replace the README's primary Excel flow with the exact `sync-lessons` command, login behavior, output layout, `--activate` semantics, resumption behavior, and the rule that each frontend selection fetches one semester file. Move `excel_to_ts.py` into a clearly labeled legacy fallback section.

- [ ] **Step 2: Add deterministic CI checks**

Keep browser-dependent live sync out of CI. Add `pnpm test`, `pnpm build`, and `uv run pytest catalog_spider/tests -q`. Do not install Playwright browsers in CI because unit tests inject transport and generated files are already committed.

- [ ] **Step 3: Run fresh full verification**

Run: `uv run pytest catalog_spider/tests -q`

Expected: all Python tests pass.

Run: `pnpm test`

Expected: all Vitest tests pass.

Run: `pnpm lint`

Expected: zero lint errors.

Run: `pnpm build`

Expected: production build succeeds.

Run: `git diff --check main...HEAD`

Expected: no whitespace errors.

- [ ] **Step 4: Verify the deployed behavior locally in the in-app browser**

Start Vite with `pnpm dev --host 127.0.0.1`. In the in-app browser verify:

1. Initial network behavior loads the manifest and only `2026-fall/courses.json`.
2. Semester text typography is unchanged and the adjacent chevron rotates on open/close.
3. Selecting summer loads `2026-summer/courses.json`, updates title/calendar/course count, and does not request autumn again eagerly.
4. Add one course to an autumn plan and one to a summer plan; switch twice and confirm isolation.
5. Grading filter options come from the selected term and filter correctly.
6. A course detail shows assessment and grading on one row, plus textbooks/materials and references.
7. Repeat at desktop width and below the 650px container breakpoint.

- [ ] **Step 5: Run final branch review and commit docs/CI**

```powershell
git add README.md catalog_spider/README.md .github/workflows/deploy.yml
git commit -m "docs: document semester catalog updates"
```

Generate a review package from `git merge-base main HEAD` through `HEAD`, dispatch the final code reviewer, address every Critical/Important finding, and rerun all commands from Step 3 after fixes.
