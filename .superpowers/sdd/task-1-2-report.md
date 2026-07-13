# Task 1-2 Report: Exact Top-8 Arrangement Search

## Status

DONE

## Design summary

- Preserved the legacy Cartesian-product implementation as the independent, test-only `enumerateArrangementsOracle`.
- Added a production engine that precomputes expanded time slots, day/period occupancy, blocked-slot hits, representative credits/hours, and conflict adjacency once per request.
- Replaced full-product materialization with depth-first search over ambiguous course buckets and reversible incremental conflict, occupancy, early-morning, credit, and hour state.
- Retains at most eight candidates in a worst-first bounded heap, then sorts only those retained candidates with the exact five-level legacy comparator.
- Kept the public `enumerateArrangements(groups, settings?)` signature and every `Arrangement` field unchanged.

## Files changed

- `src/utils/arrangement.ts`
- `src/utils/arrangementEngine.ts`
- `src/utils/arrangementEngine.test.ts`
- `src/utils/arrangementOracle.ts`
- `.superpowers/sdd/task-1-2-report.md`

## RED evidence

- Command: `pnpm exec vitest run src/utils/arrangementEngine.test.ts`
- Outcome: expected collection failure before production edits: `Cannot find module './arrangementEngine'`.

## GREEN evidence

- Focused command: `pnpm exec vitest run src/utils/arrangement.test.ts src/utils/arrangementEngine.test.ts`
- Outcome: 2 files, 17 tests passed, including deterministic comparator, blocked-slot, 40-seed × four-preference differential, and 4^8 bounded-retention coverage.
- Type check: `pnpm exec tsc -b --pretty false` exited 0.
- Full regression: `pnpm test` completed with 9 files and 51 tests passed.
- Production build: `pnpm build` succeeded; the existing large-chunk warning remains non-failing.
- Lint: `pnpm lint` exited 0.

## Implementation commit

- `01e54bedf0f04b16d411a368a3b7b996b74ba569` — `perf: implement exact top-8 arrangement search`

## Self-review

- Comparator order is exactly conflict count ascending, optional half-day descending, optional early-morning count ascending, sorted key string ascending, then credits descending.
- DFS emits candidates in the legacy Cartesian order; an internal ordinal preserves stable-sort behavior for otherwise equal candidates.
- Conflict accounting uses unique group keys, matching the legacy `Set<string>` behavior, including blocked slots and duplicate-key defense.
- Floating totals restore snapshots rather than subtracting, preventing branch-to-branch rounding drift while preserving legacy addition order.
- Diagnostics confirm 65,536 leaves for the deterministic stress case while retained candidates never exceed eight.
- No React, Worker, settings, generated semester data, or other worktree files were modified.

## Concerns

- No blocking concerns. Exactness still requires visiting the full search tree in the worst case; this is the accepted CPU trade-off, while retained memory is bounded and the later Worker task will isolate the work from the UI thread.
