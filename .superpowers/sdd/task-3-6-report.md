# Task 3-6 Report: Async Auto/Manual Arrangement Calculation

## Status

DONE

## Design and state model

- Added persisted `calculationMode: 'auto' | 'manual'` settings with legacy/invalid-value normalization to `auto`, and shared exact UI labels for customization and onboarding.
- Production enumeration now runs through a Vite module Worker using a minimal DTO protocol. The client owns monotonic generations, terminates superseded work, ignores stale replies, validates protocol data, rehydrates original `CourseGroup` references, and uses the same exact deterministic engine as its non-Worker fallback.
- Added the pure phases `empty -> dirty -> calculating -> ready | error`. Draft inputs and the committed snapshot are separate; only the latest successful generation atomically replaces committed groups, settings, and arrangements.
- Same-plan changes retain the last committed timetable while dirty/calculating/error. Plan or semester scope changes hard-reset it. Manual empty recalculation can commit an empty snapshot; a never-calculated empty draft stays `empty`.
- Calculation mode itself is not an engine input. Switching modes preserves a clean snapshot, while switching a dirty draft to automatic immediately starts calculation.
- App timetable, conflicts, statistics, export, arrangement panel, and applied-course views consume only committed data. Draft selection views continue to show current course choices. A still-valid arrangement ID survives a commit; otherwise the new first/default result is selected.
- A compact status row is always rendered, including zero/one-result cases; the full arrangement panel remains limited to multiple results.

## Files changed

- App/UI: `src/App.tsx`, `src/components/CalculationModePicker.tsx`, `src/components/CalculationStatus.tsx`, `src/components/CustomizationModal.tsx`, `src/components/onboarding/OnboardingWizard.tsx`, `src/components/onboarding/onboarding.css`, `src/index.css`
- State/persistence: `src/hooks/useArrangementCalculation.ts`, `src/utils/arrangementCalculationState.ts`, `src/utils/customization.ts`, `src/onboarding/useOnboarding.ts`
- Worker: `src/utils/arrangementWorkerClient.ts`, `src/workers/arrangementProtocol.ts`, `src/workers/arrangement.worker.ts`
- Tests: `src/utils/arrangementCalculationState.test.ts`, `src/utils/arrangementWorkerClient.test.ts`, `src/utils/customization.test.ts`, `src/onboarding/useOnboarding.test.ts`, `src/utils/arrangementEngine.test.ts`
- Report: `.superpowers/sdd/task-3-6-report.md`

## RED evidence

- Persistence/onboarding focused tests initially failed 6 assertions because calculation mode normalization and defaults did not exist.
- Shared-label test failed because `CALCULATION_MODE_OPTIONS` was absent.
- State-machine test initially failed collection because `arrangementCalculationState` did not exist.
- Worker-client test initially failed collection because `arrangementWorkerClient` did not exist.
- StrictMode cancellation recovery test failed because `recoverCancelledArrangementCalculation` did not exist.
- Malformed Worker reply test resolved an unknown protocol type instead of rejecting.

## GREEN evidence

- Focused persistence/state/engine run: 4 files, 22 tests passed.
- Final focused cancellation/Worker run: 2 files, 18 tests passed.
- Final full regression: `pnpm test` — 16 files, 83 tests passed.
- Final type check: `pnpm exec tsc -b --pretty false` — exit 0.
- Production build: `pnpm build` — succeeded and emitted `arrangement.worker-*.js`; the pre-existing large-chunk warning remains non-failing.
- Component-test DOM dependencies are not installed, so UI contracts are driven by shared pure constants/state tests as allowed by the brief.

## Implementation commit

- `080b1380cae9870ecdcdacc0d50efcd3380c7c75` — `feat: add async manual and automatic arrangement calculation`

## Self-review

- Verified committed blocked slots, not draft slots, feed both conflict detection and the rendered timetable.
- Verified errors and superseded generations cannot destroy or overwrite an older snapshot.
- Verified malformed current-generation Worker messages reject and terminate; captured/mismatched stale messages remain ignored.
- Verified React StrictMode effect replay returns an aborted active generation to a retryable draft instead of leaving `calculating` stuck.
- Verified selected arrangement preservation/defaulting, manual remove-all behavior, auto hard-reset behavior, and one-result status visibility in code and pure transition tests.
- No generated semester data, course-selection scope actions, or other worktree files were changed.

## Concerns

- No blocking concerns. The existing main-bundle size warning is unchanged and outside this task's scope.

## Follow-up race fix: calculation-mode projection

- Review found a render/effect race in `useArrangementCalculation`: a calculation-mode-only render projected an in-flight state and wrote it to `stateRef`; if the Worker completed before that render's synchronization effect, the effect could overwrite the newer `ready` state with its captured `calculating` projection.
- Added a pure regression that models the exact ordering: create an active generation, render a mode-only projection, complete that generation, then verify the stale projection is no longer eligible for effect synchronization.
- RED: `pnpm test -- src/utils/arrangementCalculationState.test.ts` ran the repository suite because of script argument forwarding and failed only the new race test with `shouldSynchronizeArrangementCalculationProjection is not a function`; the other 88 tests passed.
- Fix: the synchronization effect now commits a projection only when `stateRef.current` still has that exact projection identity. A completion, failure, or other newer transition changes the ref identity and therefore wins.
- GREEN: `pnpm exec vitest run src/utils/arrangementCalculationState.test.ts src/utils/arrangementWorkerClient.test.ts` — 2 files, 19 tests passed.
- Type check: `pnpm exec tsc -b --pretty false` — exit 0.
- Scope check: the paused untracked `src/utils/courseSelection.ts` and `src/utils/courseSelection.test.ts` were neither edited nor staged.
