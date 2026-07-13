# Optimize Course Plan Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve exact scheduling results while moving expensive enumeration off the UI thread, adding automatic/manual calculation modes, and exposing current-group/all-groups selection actions everywhere.

**Architecture:** A pure exact Top-8 search engine precomputes group occupancy and incrementally explores candidate buckets with a bounded heap. A Worker adapter executes it behind a generation-token boundary. A React calculation hook separates editable inputs from the last committed timetable snapshot, while shared selection helpers centralize batch add/remove semantics.

**Tech Stack:** React 19, TypeScript 6, Vite 8 Web Workers, Vitest, Ant Design 6.

## Global constraints

- Branch name is exactly `optimize-course-plan-calculation`.
- Do not include generated semester catalog data from commit `5b74fee`; catalog code remains available from the shared parent commit.
- Existing users and missing persisted fields default to `calculationMode: 'auto'`.
- Manual edits preserve the last successful timetable and show “待重新计算 / 开始排课”.
- Optimized output must exactly match the legacy oracle for IDs, order and metrics.
- Keep at most eight results without materializing the full Cartesian product.
- Stale or failed calculations never replace the last successful snapshot.
- Plan or semester switches hard-reset snapshots.
- Use focused tests while implementing; finish with one full `pnpm test` and `pnpm build` run.

---

### Task 1: Freeze the result contract with an oracle

**Files:**
- Modify: `src/utils/arrangement.ts`
- Modify: `src/utils/arrangement.test.ts`
- Create: `src/utils/arrangementOracle.ts` (test-only export or excluded from production path)

- [ ] Move the current brute-force algorithm behind a test-only oracle without changing behavior.
- [ ] Add deterministic comparator tests covering conflicts, half-day preference, early mornings, group-key tie break, credits and blocked slots.
- [ ] Add seeded random small-input differential test scaffolding that compares complete result objects.

### Task 2: Implement the exact bounded Top-8 engine

**Files:**
- Create: `src/utils/arrangementEngine.ts`
- Create: `src/utils/arrangementEngine.test.ts`
- Modify: `src/utils/arrangement.ts`

- [ ] Define compact precomputed group and search-state types.
- [ ] Build expanded-slot inverted indices, occupancy masks, blocked flags and conflict adjacency once per request.
- [ ] Implement reversible incremental add/remove state for DFS.
- [ ] Implement a capacity-eight max heap using the exact existing comparator.
- [ ] Return only the final sorted eight arrangements.
- [ ] Run seeded differential tests against the oracle across empty, unique, ambiguous and blocked-slot inputs.
- [ ] Add a deterministic stress case proving the engine does not allocate the Cartesian product.

### Task 3: Add the Worker protocol

**Files:**
- Create: `src/workers/arrangement.worker.ts`
- Create: `src/workers/arrangementProtocol.ts`
- Create: `src/utils/arrangementWorkerClient.ts`
- Create: `src/utils/arrangementWorkerClient.test.ts`

- [ ] Define minimal request/response DTOs with a generation token.
- [ ] Execute the pure engine in a Vite Worker and return group keys plus metrics.
- [ ] Rehydrate results from the current group index on the main thread.
- [ ] Support cancellation/termination and ignore stale tokens.
- [ ] Provide a test/non-Worker fallback with identical semantics.

### Task 4: Persist calculation mode compatibly

**Files:**
- Modify: `src/utils/customization.ts`
- Create or modify: `src/utils/customization.test.ts`
- Modify: `src/onboarding/useOnboarding.ts`

- [ ] Add `CalculationMode = 'auto' | 'manual'` and `calculationMode` to settings/preferences.
- [ ] Default new and legacy settings to `auto`.
- [ ] Validate unknown persisted values back to `auto`.
- [ ] Keep the storage key migration backward compatible.

### Task 5: Implement the calculation state machine

**Files:**
- Create: `src/hooks/useArrangementCalculation.ts`
- Create: `src/hooks/useArrangementCalculation.test.tsx`
- Modify: `src/App.tsx`

- [ ] Separate editable groups/settings from the committed calculation snapshot.
- [ ] Implement `empty`, `dirty`, `calculating`, `ready` and `error` phases.
- [ ] Auto mode schedules calculation after input changes without discarding the old snapshot.
- [ ] Manual mode marks dirty and starts only through an explicit action.
- [ ] Atomically commit only the latest successful generation.
- [ ] Preserve old results on failure and hard-reset on plan/semester identity changes.
- [ ] Ensure timetable conflicts/stats use committed groups and committed blocked slots.

### Task 6: Add manual/automatic controls and feedback

**Files:**
- Modify: `src/components/CustomizationModal.tsx`
- Modify: `src/components/onboarding/OnboardingWizard.tsx`
- Modify: `src/components/onboarding/PreferenceSwitch.tsx` or add a focused mode control
- Modify: `src/components/ArrangementPanel.tsx`
- Modify: `src/index.css`
- Modify: `src/components/onboarding/onboarding.css`

- [ ] Add “自动排课 / 手动开始排课” selection with concise descriptions to customization.
- [ ] Add the same setting to onboarding.
- [ ] Show “待重新计算” when manual inputs differ from the committed snapshot.
- [ ] Show “开始排课” without an old result and “重新计算” with one.
- [ ] Add Ant Design loading feedback and disable duplicate starts.
- [ ] Show a retryable non-blocking error while retaining old timetable content.

### Task 7: Centralize time-group/course selection operations

**Files:**
- Create: `src/utils/courseSelection.ts`
- Create: `src/utils/courseSelection.test.ts`
- Modify: `src/store/plansReducer.ts`
- Modify: `src/store/plansContext.tsx`

- [ ] Implement `idsForGroup` and `idsForCourse` with stable de-duplication.
- [ ] Expose batch add/remove commands through the plan context.
- [ ] Verify current-group and whole-course operations are idempotent.
- [ ] Ensure any effective selection change marks manual calculation dirty through input revision.

### Task 8: Wire all course-selection entry points

**Files:**
- Modify: `src/components/CoursePool.tsx`
- Modify: `src/components/CoursePoolItem.tsx`
- Modify: `src/components/CourseDetailModal.tsx`
- Modify: `src/components/SelectedCoursesModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] Add/select/remove “这个时间组” and “全部时间组” actions in the course pool.
- [ ] Add the same actions in course details.
- [ ] Apply identical semantics to current selections and curriculum candidate flows.
- [ ] Keep required-course bulk selection behavior routed through the same shared helpers.
- [ ] Use concise responsive controls without hiding which scope each action affects.

### Task 9: Integrate and verify once

**Files:**
- Modify tests only where integration coverage requires it.

- [ ] Run targeted tests during each task.
- [ ] Run one final `pnpm test`.
- [ ] Run one final `pnpm build`.
- [ ] In the in-app browser, smoke-test one automatic calculation, one manual dirty/recalculate flow, and current/all time-group add/remove at representative entry points.
- [ ] Confirm `supplement-course-information` is unchanged and this branch contains no generated semester catalog data diff.

