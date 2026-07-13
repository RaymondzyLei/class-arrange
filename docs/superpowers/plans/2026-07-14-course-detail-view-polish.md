# Course Detail View Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the course-detail modal into a compact table-and-content layout, add an animated title-level description disclosure, clean wrapping quotes from reference books, and update the onboarding tour.

**Architecture:** Keep course data and selection state in `CourseDetailModal`; extend `BottomModal` with a reusable `titleExtra` slot, and split the description trigger from its animated content. Normalize reference-book display text in the existing formatting utility. Keep onboarding changes isolated to the step definition, regression test, and tracked PNG asset.

**Tech Stack:** React 19, TypeScript, Ant Design, CSS transitions, Vitest, Vite.

## Global Constraints

- Work only on the existing `supplement-course-information` branch.
- Ordinary course metadata must remain in a bordered table; do not use pill tags for credits, hours, type, examination, grading, or language.
- The description action is a borderless text button immediately to the right of the course title, with the existing chevron rotation style.
- Strip only a paired outer ASCII double quote from reference-book text; preserve internal quotes, one-sided quotes, and Chinese book-title marks.
- Remove the current tour step 10/11, `customization-preferences`, while retaining the blocked-slot step.
- Replace the step-2 image with the exact user-provided 39-course PNG.
- Preserve `.codex-temp/` and `.superpowers/` as untracked user/session state.

---

### Task 1: Normalize wrapping reference-book quotes

**Files:**
- Modify: `src/utils/courseDetails.ts`
- Test: `src/utils/courseDetails.test.ts`

**Interfaces:**
- Consumes: `CourseDetail.referenceBooks: string`.
- Produces: `stripWrappingDoubleQuotes(value: string): string` and a normalized `CourseMaterialDisplay.referenceBooks`.

- [ ] **Step 1: Write the failing formatting tests**

Add these cases to `src/utils/courseDetails.test.ts`:

```ts
it('removes one paired outer double quote from reference books', () => {
  const detail = makeDetail({ referenceBooks: '  "《复变函数》，科学出版社"  ' });
  expect(formatCourseMaterialDisplay(detail).referenceBooks).toBe('《复变函数》，科学出版社');
});

it('preserves internal and one-sided reference-book quotes', () => {
  expect(formatCourseMaterialDisplay(makeDetail({
    referenceBooks: '《“复变函数”导读》，科学出版社"',
  })).referenceBooks).toBe('《“复变函数”导读》，科学出版社"');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
pnpm exec vitest run src/utils/courseDetails.test.ts --reporter=dot
```

Expected: the paired-quote test fails because the current formatter returns the surrounding `"` characters.

- [ ] **Step 3: Implement the minimal normalizer**

Add to `src/utils/courseDetails.ts`:

```ts
export function stripWrappingDoubleQuotes(value: string): string {
  const normalized = value.trim();
  return normalized.length >= 2
    && normalized.startsWith('"')
    && normalized.endsWith('"')
    ? normalized.slice(1, -1).trim()
    : normalized;
}
```

Use it in the returned material display:

```ts
referenceBooks: stripWrappingDoubleQuotes(detail.referenceBooks) || EMPTY_VALUE,
```

- [ ] **Step 4: Run the formatting tests and verify GREEN**

Run the same Vitest command. Expected: all `courseDetails.test.ts` tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/courseDetails.ts src/utils/courseDetails.test.ts
git commit -m "fix: clean wrapping reference book quotes"
```

---

### Task 2: Add the title-level animated description disclosure

**Files:**
- Modify: `src/components/BottomModal.tsx`
- Modify: `src/components/CourseDescriptionPanel.tsx`
- Modify: `src/components/CourseDetailModal.tsx`
- Modify: `src/index.css`
- Test: `src/components/CourseDescriptionPanel.test.ts`

**Interfaces:**
- Produces: `BottomModal` prop `titleExtra?: ReactNode`.
- Produces: named component `CourseDescriptionToggle({ panelId, open, onOpenChange })`.
- Changes: `CourseDescriptionPanel` props to `{ detail?: CourseDetail; panelId: string; open: boolean }`.

- [ ] **Step 1: Write failing disclosure structure tests**

Update `src/components/CourseDescriptionPanel.test.ts` to render the trigger and panel separately and assert:

```ts
const toggleHtml = renderToStaticMarkup(createElement(CourseDescriptionToggle, {
  panelId: 'description-panel',
  open: false,
  onOpenChange: vi.fn(),
}));
expect(toggleHtml).toContain('ant-btn-text');
expect(toggleHtml).toContain('查看课程简介');
expect(toggleHtml).toContain('select-chevron');
expect(toggleHtml).toContain('aria-expanded="false"');

const openHtml = renderToStaticMarkup(createElement(CourseDescriptionPanel, {
  detail: makeDetail({ cn: '中文简介', en: 'English description' }),
  panelId: 'description-panel',
  open: true,
}));
expect(openHtml).toContain('course-description-region--open');
expect(openHtml).toContain('中文简介');
expect(openHtml).toContain('English description');
```

Read `BottomModal.tsx` and `CourseDetailModal.tsx` as source in the same test and assert that `titleExtra` is rendered and receives `CourseDescriptionToggle`.

- [ ] **Step 2: Run the tests and verify RED**

```powershell
pnpm exec vitest run src/components/CourseDescriptionPanel.test.ts --reporter=dot
```

Expected: fail because `CourseDescriptionToggle`, `titleExtra`, and the animated-region classes do not exist.

- [ ] **Step 3: Extend the modal header**

Add `titleExtra?: ReactNode` to `BottomModal` and render:

```tsx
<div className="bottom-modal__heading">
  <h2 className="bottom-modal__title">{title}</h2>
  {titleExtra ? <div className="bottom-modal__title-extra">{titleExtra}</div> : null}
</div>
```

Keep existing selection `actions` and close button as separate right-side controls.

- [ ] **Step 4: Split the toggle from animated content**

In `CourseDescriptionPanel.tsx`, export:

```tsx
export function CourseDescriptionToggle({ panelId, open, onOpenChange }: ToggleProps) {
  return (
    <Button
      size="small"
      type="text"
      className="course-description-toggle"
      aria-controls={panelId}
      aria-expanded={open}
      icon={<ChevronIcon className={`select-chevron${open ? ' select-chevron--open' : ''}`} />}
      iconPosition="end"
      onClick={() => onOpenChange(!open)}
    >
      查看课程简介
    </Button>
  );
}
```

Always render the description region so CSS can animate it:

```tsx
<section
  id={panelId}
  className={`course-description-region${open ? ' course-description-region--open' : ''}`}
  aria-hidden={!open}
>
  <div className="course-description-region__clip">
    <div className="course-description-panel" role="region" aria-label="课程简介">
      {/* existing Chinese, English, and empty content */}
    </div>
  </div>
</section>
```

- [ ] **Step 5: Wire the title control into course details**

Use `useId()` in `CourseDetailModal`, pass the toggle through `titleExtra`, and keep only the animated region in the body:

```tsx
const descriptionPanelId = useId();

<BottomModal
  title={courseTitle}
  titleExtra={(
    <CourseDescriptionToggle
      panelId={descriptionPanelId}
      open={descriptionOpen}
      onOpenChange={setDescriptionOpen}
    />
  )}
  /* existing props */
>
  <CourseDescriptionPanel
    detail={displayDetail}
    panelId={descriptionPanelId}
    open={descriptionOpen}
  />
```

- [ ] **Step 6: Add alignment and animation CSS**

Add header alignment and a 180 ms disclosure animation:

```css
.bottom-modal__heading {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bottom-modal__title-extra { flex: 0 0 auto; }
.course-description-toggle.ant-btn { padding-inline: 4px; color: var(--accent); }
.course-description-region { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .18s ease, opacity .18s ease, margin-bottom .18s ease; }
.course-description-region--open { grid-template-rows: 1fr; opacity: 1; margin-bottom: 12px; }
.course-description-region__clip { min-height: 0; overflow: hidden; }
.course-description-panel { padding-top: 8px; }
```

Remove the old bordered button/disclosure wrapper styling. At mobile width, allow `.bottom-modal__heading` to use the first header row while the existing selection actions wrap below.

- [ ] **Step 7: Run the disclosure tests and verify GREEN**

Run the focused test. Expected: all disclosure tests pass.

- [ ] **Step 8: Commit**

```powershell
git add src/components/BottomModal.tsx src/components/CourseDescriptionPanel.tsx src/components/CourseDetailModal.tsx src/components/CourseDescriptionPanel.test.ts src/index.css
git commit -m "feat: move course description into modal title"
```

---

### Task 3: Reorganize course details without metadata tags

**Files:**
- Modify: `src/components/CourseDetailModal.tsx`
- Modify: `src/index.css`
- Create: `src/components/CourseDetailLayout.test.ts`

**Interfaces:**
- Consumes: existing `sectionLabel`, `materialDisplay`, `examType`, `grading`, `singleRating`, and representative section fields.
- Produces: `.course-detail-overview`, `.course-material-groups`, and `.course-material-group` layout hooks.

- [ ] **Step 1: Write failing source/layout tests**

Create `CourseDetailLayout.test.ts` and assert that `CourseDetailModal.tsx` contains a bordered `Descriptions` table with the ordinary metadata fields and no ordinary metadata Tags:

```ts
expect(source).toContain('className="course-detail-overview"');
for (const label of ['学分 / 学时', '课程类型', '考核方式', '评分制', '授课语言']) {
  expect(source).toContain(`label="${label}"`);
}
expect(source).toContain('className="course-material-groups"');
expect(source).not.toContain('<Tag color="blue">是</Tag>');
```

Also assert that reference books and textbook/handout groups are outside the `Descriptions` block and that the mobile view does not render pills.

- [ ] **Step 2: Run the test and verify RED**

```powershell
pnpm exec vitest run src/components/CourseDetailLayout.test.ts --reporter=dot
```

Expected: fail because the new classes and grouped material section do not exist.

- [ ] **Step 3: Build the compact bordered metadata table**

Keep Ant Design `Descriptions`, change it to three logical columns on desktop, and use explicit spans:

```tsx
<Descriptions className="course-detail-overview" size="small" column={3} bordered>
  <Descriptions.Item label="课堂号/班次">{sectionLabel}</Descriptions.Item>
  <Descriptions.Item label="开课单位" span={2}>{departmentLabel}</Descriptions.Item>
  <Descriptions.Item label="授课教师" span={3}>{teacherLabel}</Descriptions.Item>
  <Descriptions.Item label="学分 / 学时">{creditsAndHours}</Descriptions.Item>
  <Descriptions.Item label="课程类型">{courseType}</Descriptions.Item>
  <Descriptions.Item label="授课语言">{language}</Descriptions.Item>
  <Descriptions.Item label="考核方式">{examType}</Descriptions.Item>
  <Descriptions.Item label="评分制">{grading}</Descriptions.Item>
  {/* optional state/rating occupies the final cell, using plain text */}
</Descriptions>
```

Render “本研同堂” as plain text `是` instead of a Tag. Keep icourse as its semantic link.

- [ ] **Step 4: Move long material text into grouped content blocks**

After the desktop/mobile summary, render one shared section:

```tsx
<section className="course-material-groups" aria-label="教材与参考资料">
  <Typography.Title level={5}>教材与参考资料</Typography.Title>
  <div className="course-material-group">
    <span className="course-material-group__label">参考书</span>
    <div className="course-material-group__value">{materialDisplay.referenceBooks}</div>
  </div>
  <div className="course-material-group">
    <span className="course-material-group__label">教材</span>
    <div className="course-material-group__value">{materialDisplay.textbooks}</div>
  </div>
  <div className="course-material-group">
    <span className="course-material-group__label">讲义</span>
    <div className="course-material-group__value">{materialDisplay.materials}</div>
  </div>
</section>
```

Remove the duplicated material rows from desktop and mobile summaries.

- [ ] **Step 5: Add compact responsive CSS**

Use stable label widths, natural wrapping, and grouped materials:

```css
.course-detail-overview .ant-descriptions-item-label { width: 112px; }
.course-detail-overview .ant-descriptions-item-content { min-width: 140px; }
.course-material-groups { margin-top: 14px; }
.course-material-groups > .ant-typography { margin: 0 0 8px; }
.course-material-group { display: grid; grid-template-columns: 112px minmax(0,1fr); border: 1px solid var(--detail-grid-border); border-bottom: 0; }
.course-material-group:last-child { border-bottom: 1px solid var(--detail-grid-border); }
.course-material-group__label { padding: 9px 12px; background: var(--detail-label-bg); }
.course-material-group__value { min-width: 0; padding: 9px 12px; overflow-wrap: anywhere; }
```

At mobile width, switch material rows to one column only if the two-column form would force unreadably narrow text.

- [ ] **Step 6: Run the layout test and verify GREEN**

Run the focused test. Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add src/components/CourseDetailModal.tsx src/components/CourseDetailLayout.test.ts src/index.css
git commit -m "feat: reorganize course detail information"
```

---

### Task 4: Update onboarding sequence and preview image

**Files:**
- Modify: `src/onboarding/tourSteps.tsx`
- Modify: `src/components/onboarding/OnboardingContent.test.ts`
- Replace: `src/assets/onboarding/arrangement-preview.png`

**Interfaces:**
- Produces: a tour without `customization-preferences` and a step-2 preview showing 39 courses, 97.5 credits, and eight arrangements.

- [ ] **Step 1: Write failing onboarding assertions**

Add to `OnboardingContent.test.ts`:

```ts
expect(tourStepsSource).not.toContain("id: 'customization-preferences'");
expect(tourStepsSource).not.toContain("title: '调整排课倾向'");
expect(tourStepsSource).toContain("id: 'customization-blocked-slots'");
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
pnpm exec vitest run src/components/onboarding/OnboardingContent.test.ts --reporter=dot
```

Expected: fail because the 10/11 preference step is still present.

- [ ] **Step 3: Remove only the requested tour step**

Delete the complete `customization-preferences` object from `tourSteps.tsx`. Do not remove `customization-entry`, `customization-blocked-slots`, or the final completion screen.

- [ ] **Step 4: Replace the tracked PNG with the supplied file**

Copy the exact user attachment:

```powershell
Copy-Item -LiteralPath 'C:\Users\SYH\AppData\Local\Temp\codex-clipboard-d08b7e27-9546-4e01-a626-ac6e296c765f.png' -Destination 'src\assets\onboarding\arrangement-preview.png' -Force
```

Inspect the copied file and confirm it visibly contains `共 8 种方案`, `39 门 · 97.5 学分`, and `35 冲突`.

- [ ] **Step 5: Run onboarding tests and verify GREEN**

Run the focused test. Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add src/onboarding/tourSteps.tsx src/components/onboarding/OnboardingContent.test.ts src/assets/onboarding/arrangement-preview.png
git commit -m "fix: refresh onboarding tour sequence"
```

---

### Task 5: Browser and build verification

**Files:**
- Modify only if verification exposes a scoped defect.

**Interfaces:**
- Verifies all interfaces produced by Tasks 1–4.

- [ ] **Step 1: Run focused regression tests**

```powershell
pnpm exec vitest run src/utils/courseDetails.test.ts src/components/CourseDescriptionPanel.test.ts src/components/CourseDetailLayout.test.ts src/components/onboarding/OnboardingContent.test.ts --reporter=dot
```

Expected: all focused tests pass.

- [ ] **Step 2: Verify the desktop detail modal in the in-app browser**

Open a course with long reference-book data and confirm:

- title, borderless description toggle, selection actions, and close button align;
- the chevron rotates and the description expands/collapses smoothly;
- ordinary metadata appears only in the bordered table;
- reference books have no extra paired outer quote;
- material text wraps without large empty cells.

- [ ] **Step 3: Verify mobile layout**

Resize to a narrow viewport and confirm the title control remains aligned, selection actions wrap below, material rows stay readable, and the body does not overflow horizontally.

- [ ] **Step 4: Verify onboarding step 2 and numbering**

Restart the guide, confirm step 2 shows the supplied 39-course PNG, and advance through customization to verify “调整排课倾向” is absent while “设置占位时间” remains.

- [ ] **Step 5: Run the production build and workspace checks**

```powershell
pnpm build
git diff --check
git status --short
```

Expected: build succeeds; only `.codex-temp/` and `.superpowers/` remain untracked.

- [ ] **Step 6: Commit any verification-only fixes**

If no fix was needed, do not create an empty commit. Otherwise stage only the scoped files and commit with a message describing the verified correction.

