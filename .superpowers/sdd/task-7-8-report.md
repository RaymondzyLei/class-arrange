# Task 7-8 Report: Course Selection Scopes

## Status

DONE

## Design summary

- Added pure `idsForGroup` and `idsForCourse` helpers that preserve first-seen order, remove duplicate section IDs, and never mutate source groups.
- Reused the existing idempotent reducer `addCourses` / `removeCourses` actions; no selection or calculation state was added.
- Every selection entry point now distinguishes the represented time group from every time group for the course. Whole-course actions always read the full catalog `groupsByCode`, not filtered or currently rendered groups.
- Shared conflict summaries report only existing courses that actually intersect the requested scope, exclude alternatives for the same course, and remain non-blocking.
- Partial selection followed by select-all dispatches the full stable ID set; the reducer adds only missing IDs. Repeated add/remove retains the active plan object and therefore does not dirty manual calculation when nothing effectively changes.

## Files changed

- Wiring: `src/App.tsx`
- Course pool: `src/components/CoursePool.tsx`, `src/components/CoursePoolItem.tsx`
- Detail modal: `src/components/CourseDetailModal.tsx`
- Selected/curriculum/candidate manager: `src/components/SelectedCoursesModal.tsx`
- Responsive actions: `src/index.css`
- Pure helpers and tests: `src/utils/courseSelection.ts`, `src/utils/courseSelection.test.ts`
- Report: `.superpowers/sdd/task-7-8-report.md`

## Entry-point coverage matrix

| Surface | Current-time-group scope | Whole-course scope | Notes |
| --- | --- | --- | --- |
| Course-pool item | Explicit select/remove button using `idsForGroup` | Explicit select/remove button using full `groupsByCode` | Button clicks stop row-detail propagation; both scopes show non-blocking conflict summaries. |
| Course-detail modal | Explicit select/remove action for the displayed group | Explicit select/remove-all action for the displayed course | Full catalog IDs, cached close animation preserved, responsive header actions wrap on mobile. |
| Current/all selected desktop tables | `移除此时间组` | `移除全部时间组` | Shared columns retain row-click-to-detail and checkbox interactions. |
| Current/all selected mobile cards | `移除此时间组` | `移除全部时间组` | Click and keyboard propagation from action controls is stopped. |
| Curriculum desktop/mobile | Single-group courses expose both scopes; multi-group courses open group selection | Direct `选择/移除全部时间组` | Selection status distinguishes partial from complete selection. |
| Multi-time-group candidate table/cards/modal | Each candidate row/card explicitly selects or removes that group | Each row/card and the modal header expose select/remove-all | Conflict tags use the shared scoped summary and exclude unrelated conflicts. |
| One-click required courses | N/A (course-level flow) | Required course IDs are composed with `idsForCourse` | One batch adds only missing IDs and emits at most one aggregated conflict warning. |

## RED evidence

- Command: `pnpm exec vitest run src/utils/courseSelection.test.ts`
- Outcome before production helper creation: expected collection failure, `Cannot find module './courseSelection'`.
- The first attempted reducer import exposed an unrelated Vitest alias-resolution failure for `@/utils/planSeed`; the test now isolates those unused reducer dependencies, after which the intended missing-helper RED was observed.

## GREEN evidence

- Focused utility/reducer command: `pnpm exec vitest run src/utils/courseSelection.test.ts`
- Outcome: 1 file, 4 tests passed, covering stable IDs, de-duplication, missing courses, partial/select-all behavior, idempotent batch add/remove, and scoped conflict names.
- Type check: `pnpm exec tsc -b --pretty false` exited 0.
- Production build: `pnpm build` exited 0; Vite transformed 996 modules and emitted the Worker bundle.
- No DOM component test library is installed; focused behavior is covered through pure utilities/reducer tests, with all component contracts type-checked by the production build.

## Implementation commit

- `e887cfc9fd8c13e16c742b8b22fe7417d3ce1419` — `feat: add course selection scope actions`

## Self-review

- Verified whole-course IDs come from the unfiltered semester catalog map in every entry point.
- Verified current-group actions use only IDs represented by that `CourseGroup`.
- Verified partial course state renders as partial, and select-all relies on reducer idempotence to add only missing IDs.
- Verified row/card detail opening, button propagation, visible labels, aria labels, current selection visuals, mobile wrapping, and virtual-row height observation remain intact.
- Verified conflict summaries do not include unrelated conflicts or same-course alternatives and never block selection.
- Verified no Worker, arrangement-calculation state, reducer architecture, or generated semester data was changed.

## Concerns

- No blocking concerns. The pre-existing Vite warning for chunks over 500 kB remains non-failing and is outside this task's scope.
