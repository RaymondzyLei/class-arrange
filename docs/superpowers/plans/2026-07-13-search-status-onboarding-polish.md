# Search, Status, and Onboarding Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify scheduling status copy, keep the semester chevron stable, move teacher search beside the input, and replace tour step 2 with a real PNG that shows multiple arrangements.

**Architecture:** Keep the existing state and filtering behavior unchanged while simplifying their presentation. Add focused server-render/source regression tests, then capture a deterministic light-theme browser state as a versioned onboarding asset and render that asset inside the existing spotlight geometry.

**Tech Stack:** React 19, TypeScript, Ant Design 6, Vitest, Vite, in-app browser.

## Global Constraints

- Dirty and ready states must display exactly `课程或偏好已变更。` and `当前课表来自最近一次成功计算。`.
- The semester chevron must remain visible while a semester is loading.
- Remove all result-count UI and its `resultCount` prop; place `查询任课老师` to the right of the search input.
- Add `稍后可在“自定义”中修改设置` below the onboarding preference title.
- Tour step 2/11 must use a real PNG with multiple arrangement cards.
- Preserve `.codex-temp/` without modification.

---

### Task 1: Single-line calculation status

**Files:**
- Create: `src/components/CalculationStatus.test.tsx`
- Modify: `src/components/CalculationStatus.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing `Props` and `ArrangementCalculationPhase`.
- Produces: one `.calculation-status__message` text node plus the existing action button.

- [ ] **Step 1: Write the failing test**

Render `CalculationStatus` for dirty/manual/snapshot and ready states, assert the exact requested sentences, and assert the old titles are absent.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/components/CalculationStatus.test.tsx`

Expected: FAIL because `待重新计算` and `排课结果已就绪` still render.

- [ ] **Step 3: Implement the minimal copy model**

Change `statusCopy` to return one string, including:

```tsx
case 'dirty':
  return '课程或偏好已变更。';
case 'ready':
  return '当前课表来自最近一次成功计算。';
```

Render `<span className="calculation-status__message">{message}</span>` and replace the obsolete title/description CSS with a single flexible line.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm exec vitest run src/components/CalculationStatus.test.tsx`

Commit: `fix: simplify arrangement status copy`

### Task 2: Persistent semester chevron

**Files:**
- Modify: `src/components/SemesterDropdown.test.ts`
- Modify: `src/components/SemesterDropdown.tsx`

**Interfaces:**
- Consumes: existing `loading: boolean`.
- Produces: a disabled, `aria-busy` button whose `ChevronIcon` is always mounted.

- [ ] **Step 1: Add a failing loading-state test**

Render with `loading: true`; require `select-chevron` and reject Ant Design's loading icon class.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/components/SemesterDropdown.test.ts`

Expected: FAIL because loading currently removes the chevron.

- [ ] **Step 3: Keep the icon mounted**

Remove the Button `loading` prop and conditional icon. Add `disabled={loading}` and `aria-busy={loading}` while always rendering:

```tsx
icon={<ChevronIcon className={`select-chevron${open ? ' select-chevron--open' : ''}`} />}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm exec vitest run src/components/SemesterDropdown.test.ts`

Commit: `fix: keep semester chevron visible`

### Task 3: Teacher search in the search row

**Files:**
- Create: `src/components/FilterBar.test.tsx`
- Modify: `src/components/FilterBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Removes: `FilterBar` prop `resultCount: number`.
- Preserves: `filter`, `setFilter`, `options`, and `includeTeacher` behavior.

- [ ] **Step 1: Write the failing layout test**

Render `FilterBar`; assert no `共 N 门` text, assert the teacher checkbox occurs inside `filter-bar__search`, and source-check that `resultCount` is absent from the component contract.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/components/FilterBar.test.tsx`

Expected: FAIL because the count renders and the checkbox is in the controls grid.

- [ ] **Step 3: Move the checkbox and remove the count chain**

Move the existing checkbox immediately after `<Input />`, delete the count span and prop, and remove `resultCount={filteredGroups.length}` from `App.tsx`.

Use:

```css
.filter-bar__search {
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: 8px;
}

.filter-bar__teacher-toggle {
  justify-self: end;
  white-space: nowrap;
}
```

Remove count-specific desktop, mobile, and dark-theme CSS. Keep the six select controls as a three-column grid.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm exec vitest run src/components/FilterBar.test.tsx`

Commit: `fix: place teacher search beside input`

### Task 4: Onboarding copy and PNG-backed step 2

**Files:**
- Create: `src/components/onboarding/OnboardingContent.test.tsx`
- Modify: `src/components/onboarding/OnboardingWizard.tsx`
- Modify: `src/components/onboarding/SpotlightTour.tsx`
- Modify: `src/components/onboarding/onboarding.css`
- Modify: `src/onboarding/tourSteps.tsx`
- Create: `src/assets/onboarding/arrangement-preview.png`

**Interfaces:**
- Produces: imported `arrangementPreviewImage` rendered by `ArrangementPanelPreview`.
- Preserves: `preview: 'arrangementPanel'` and the existing target/position calculation.

- [ ] **Step 1: Write failing content tests**

Assert `OnboardingWizard` contains `稍后可在“自定义”中修改设置`; assert `SpotlightTour` imports `arrangement-preview.png`; assert step 2 description still mentions multiple arrangements and at most 8 results.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/components/onboarding/OnboardingContent.test.tsx`

Expected: FAIL because the note and PNG import do not exist.

- [ ] **Step 3: Implement copy and image rendering**

Add the note below the step-1 heading. Replace the generated six-card preview JSX with:

```tsx
<div className="spotlight-tour__arrangement-preview" data-tour="arrangement-preview" style={...}>
  <img src={arrangementPreviewImage} alt="包含多种排课方案的示例" />
</div>
```

Update step 2 copy to explain that one saved course list can yield multiple time-group arrangements and that at most 8 are shown. Style the image to fill the target width, preserve aspect ratio, and use the existing panel radius/border.

- [ ] **Step 4: Capture the real PNG**

Open the local app in light mode, select enough course time groups to produce multiple arrangements, wait for a successful calculation, and capture the combined status/arrangement region into `src/assets/onboarding/arrangement-preview.png`. The image must show the simplified ready message and at least four arrangement cards.

- [ ] **Step 5: Verify GREEN and commit**

Run: `pnpm exec vitest run src/components/onboarding/OnboardingContent.test.tsx`

Commit: `feat: refresh onboarding arrangement preview`

### Task 5: Final visual and build verification

**Files:**
- No additional production files expected.

**Interfaces:**
- Verifies all outputs from Tasks 1-4.

- [ ] **Step 1: Browser verification**

Check desktop and narrow viewport search-row widths, switch semesters and confirm the chevron remains visible, open onboarding preferences and tour step 2/11, and inspect the real preview PNG.

- [ ] **Step 2: Focused tests**

Run:

```powershell
pnpm exec vitest run src/components/CalculationStatus.test.tsx src/components/SemesterDropdown.test.ts src/components/FilterBar.test.tsx src/components/onboarding/OnboardingContent.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Production build and clean diff**

Run:

```powershell
pnpm build
git diff --check
git status --short
```

Expected: build exit 0; no whitespace errors; only user-owned `.codex-temp/` remains untracked.
