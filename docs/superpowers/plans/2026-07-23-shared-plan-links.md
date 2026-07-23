# Shared Plan Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-free snapshot links that let users preview and import one named course plan into the correct semester.

**Architecture:** A pure `sharedPlan` utility owns the wire format, validation, URL generation, and import naming. The existing plans reducer gains one atomic import action; focused sender and receiver modals render the workflow, while a hook coordinates fragment parsing and semester switching without writing storage directly.

**Tech Stack:** React 19, TypeScript 6, Ant Design 6, Vite 8, Vitest 3, existing Context + reducer state.

## Global Constraints

- Share only `{ version, semester key, source plan name, selected course IDs }`.
- Encode compact JSON as UTF-8 Base64URL in `#plan=<payload>`.
- Do not add a backend, account system, compression library, or QR code.
- Plan names are limited to 20 characters.
- Course IDs are deduplicated in source order, with at most 100 IDs.
- The complete generated URL must not exceed 1800 characters.
- Reuse a plan only when the current semester has exactly one plan and it is empty.
- Never overwrite or merge into any other existing plan.
- Keep the existing 10-plan limit.
- Import valid courses and warn about missing courses; block import when all are missing.
- Button order must be create, share, delete, more.

---

## File Map

- Create `src/utils/sharedPlan.ts`: wire format, Base64URL codec, validation, URL helpers, reusable-empty detection, and import naming.
- Create `src/utils/sharedPlan.test.ts`: codec, validation, URL bounds, and naming tests.
- Modify `src/store/plansReducer.ts`: atomic `importPlan` action.
- Create `src/store/plansReducer.test.ts`: reducer import behavior.
- Create `src/components/SharePlanModal.tsx`: sender summary, copy, and optional system share.
- Create `src/components/SharedPlanImportModal.tsx`: receiver preview and import restrictions.
- Create `src/hooks/useSharedPlanImport.ts`: fragment lifecycle, target-semester switching, and catalog matching.
- Create `src/hooks/useSharedPlanImport.test.ts`: pure import-preview derivation tests exposed by the hook module.
- Modify `src/data/SemesterCatalogContext.tsx`: prefer a valid shared semester during initial catalog load.
- Modify `src/components/PlanSwitcher.tsx`: share button and sender modal.
- Modify `src/App.tsx`: wire import hook and receiver modal.
- Modify `src/components/icons.tsx`: share glyph.
- Modify `src/index.css`: compact selector and both modal layouts.
- Create `src/components/SharedPlanUI.test.ts`: source-level UI contract and responsive CSS checks.
- Modify `README.md`: document snapshot sharing.

---

### Task 1: Versioned share payload and naming

**Files:**
- Create: `src/utils/sharedPlan.ts`
- Create: `src/utils/sharedPlan.test.ts`

**Interfaces:**
- Produces: `SharedPlanPayload`, `SharedPlanParseResult`, `encodeSharedPlan`, `parseSharedPlanFragment`, `buildSharedPlanUrl`, `clearSharedPlanFragment`, `hasReusableSingleEmptyPlan`, and `resolveImportedPlanName`.

- [ ] **Step 1: Write failing codec and validation tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildSharedPlanUrl,
  encodeSharedPlan,
  parseSharedPlanFragment,
  resolveImportedPlanName,
} from './sharedPlan';

describe('shared plan links', () => {
  const payload = {
    version: 1 as const,
    semesterKey: '2026-fall',
    name: '周二无早八',
    courseIds: ['MATH1006.01', 'PHYS1001B.02'],
  };

  it('round-trips UTF-8 data through a URL-safe fragment', () => {
    const encoded = encodeSharedPlan(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseSharedPlanFragment(`#plan=${encoded}`)).toEqual({
      kind: 'success',
      payload,
    });
  });

  it('deduplicates course IDs without changing source order', () => {
    const encoded = encodeSharedPlan({
      ...payload,
      courseIds: ['A.01', 'B.01', 'A.01'],
    });
    expect(parseSharedPlanFragment(`#plan=${encoded}`)).toMatchObject({
      kind: 'success',
      payload: { courseIds: ['A.01', 'B.01'] },
    });
  });

  it('rejects truncated, unsupported, empty, and oversized payloads', () => {
    expect(parseSharedPlanFragment('#plan=broken')).toMatchObject({ kind: 'error' });
    const unsupported = btoa(JSON.stringify({ v: 2, s: 'x', n: 'x', c: ['A'] }))
      .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(parseSharedPlanFragment(`#plan=${unsupported}`)).toMatchObject({ kind: 'error' });
    expect(() => encodeSharedPlan({ ...payload, courseIds: [] })).toThrow();
    expect(() => encodeSharedPlan({
      ...payload,
      courseIds: Array.from({ length: 101 }, (_, index) => `A.${index}`),
    })).toThrow();
  });

  it('enforces the complete URL length limit', () => {
    expect(() => buildSharedPlanUrl(payload, `https://example.test/${'x'.repeat(1800)}`))
      .toThrow('分享链接过长');
  });

  it('normalizes default names and suffixes duplicate custom names', () => {
    const plans = [
      { id: '1', name: '方案一', createdAt: 1, updatedAt: 1, courseIds: ['A'] },
      { id: '2', name: '无早八', createdAt: 1, updatedAt: 1, courseIds: ['B'] },
    ];
    expect(resolveImportedPlanName('方案九', plans)).toBe('方案二');
    expect(resolveImportedPlanName('无早八', plans)).toBe('无早八 副本');
    expect(resolveImportedPlanName('周五没课', plans)).toBe('周五没课');
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- src/utils/sharedPlan.test.ts`

Expected: FAIL because `./sharedPlan` does not exist.

- [ ] **Step 3: Implement the pure share utility**

```ts
import type { Plan } from '@/types';
import { nextDefaultPlanName, nextDuplicatePlanName } from './planSeed';

export const SHARED_PLAN_VERSION = 1 as const;
export const MAX_SHARED_COURSES = 100;
export const MAX_SHARED_URL_LENGTH = 1800;
const MAX_NAME_LENGTH = 20;
const MAX_KEY_LENGTH = 64;
const DEFAULT_NAME = /^方案(?:[一二三四五六七八九十百\d]+)$/;

export interface SharedPlanPayload {
  version: 1;
  semesterKey: string;
  name: string;
  courseIds: string[];
}

export type SharedPlanParseResult =
  | { kind: 'none' }
  | { kind: 'success'; payload: SharedPlanPayload }
  | { kind: 'error'; message: string };

interface SharedPlanWireV1 {
  v: 1;
  s: string;
  n: string;
  c: string[];
}

function normalize(input: SharedPlanPayload): SharedPlanPayload {
  const name = input.name.trim();
  const semesterKey = input.semesterKey.trim();
  const courseIds = [...new Set(input.courseIds.map((id) => id.trim()))];
  if (input.version !== 1) throw new Error('分享方案版本不受支持');
  if (!name || name.length > MAX_NAME_LENGTH) throw new Error('方案名称无效');
  if (!semesterKey || semesterKey.length > MAX_KEY_LENGTH) throw new Error('学期标识无效');
  if (
    courseIds.length === 0
    || courseIds.length > MAX_SHARED_COURSES
    || courseIds.some((id) => !id || id.length > MAX_KEY_LENGTH)
  ) throw new Error('分享课程列表无效');
  return { version: 1, semesterKey, name, courseIds };
}

// Implement UTF-8 bytes through TextEncoder/TextDecoder, btoa/atob, and
// Base64URL substitutions. Encode wire keys v/s/n/c and return normalized data
// from parseSharedPlanFragment().

export function buildSharedPlanUrl(payload: SharedPlanPayload, href: string): string {
  const url = new URL(href);
  url.hash = `plan=${encodeSharedPlan(payload)}`;
  if (url.href.length > MAX_SHARED_URL_LENGTH) throw new Error('分享链接过长');
  return url.href;
}

export function hasReusableSingleEmptyPlan(plans: Plan[]): boolean {
  return plans.length === 1 && plans[0].courseIds.length === 0;
}

export function resolveImportedPlanName(sourceName: string, retainedPlans: Plan[]): string {
  if (DEFAULT_NAME.test(sourceName)) return nextDefaultPlanName(retainedPlans);
  if (!retainedPlans.some((plan) => plan.name === sourceName)) return sourceName;
  return nextDuplicatePlanName(sourceName, retainedPlans);
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run: `pnpm test -- src/utils/sharedPlan.test.ts`

Expected: PASS for all shared-plan utility tests.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/sharedPlan.ts src/utils/sharedPlan.test.ts
git commit -m "feat: add shared plan link codec"
```

---

### Task 2: Atomic plan import

**Files:**
- Modify: `src/store/plansReducer.ts`
- Create: `src/store/plansReducer.test.ts`

**Interfaces:**
- Consumes: a resolved import name and valid course IDs.
- Produces: `PlansAction` variant `{ type: 'importPlan'; name: string; courseIds: string[] }`.

- [ ] **Step 1: Write failing reducer tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { plansReducer } from './plansReducer';

describe('plansReducer importPlan', () => {
  it('reuses the only empty plan and preserves its id and createdAt', () => {
    const state = {
      plans: [{ id: 'p1', name: '空白', createdAt: 1, updatedAt: 1, courseIds: [] }],
      activePlanId: 'p1',
    };
    vi.spyOn(Date, 'now').mockReturnValue(10);
    const next = plansReducer(state, {
      type: 'importPlan',
      name: '同学的方案',
      courseIds: ['A.01', 'A.01', 'B.01'],
    });
    expect(next).toEqual({
      plans: [{
        id: 'p1',
        name: '同学的方案',
        createdAt: 1,
        updatedAt: 10,
        courseIds: ['A.01', 'B.01'],
      }],
      activePlanId: 'p1',
    });
  });

  it('creates and activates a plan without overwriting existing plans', () => {
    const state = {
      plans: [{ id: 'p1', name: '方案一', createdAt: 1, updatedAt: 1, courseIds: ['A'] }],
      activePlanId: 'p1',
    };
    const next = plansReducer(state, {
      type: 'importPlan',
      name: '同学的方案',
      courseIds: ['B.01'],
    });
    expect(next.plans[0]).toEqual(state.plans[0]);
    expect(next.plans[1]).toMatchObject({ name: '同学的方案', courseIds: ['B.01'] });
    expect(next.activePlanId).toBe(next.plans[1].id);
  });

  it('defensively refuses an eleventh plan', () => {
    const plans = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      name: `P${index}`,
      createdAt: 1,
      updatedAt: 1,
      courseIds: ['A'],
    }));
    const state = { plans, activePlanId: '0' };
    expect(plansReducer(state, {
      type: 'importPlan',
      name: 'extra',
      courseIds: ['B'],
    })).toBe(state);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- src/store/plansReducer.test.ts`

Expected: FAIL because `importPlan` is not a valid action and the reducer does not import.

- [ ] **Step 3: Add the atomic reducer action**

```ts
export type PlansAction =
  // existing actions
  | { type: 'importPlan'; name: string; courseIds: string[] };

case 'importPlan': {
  const courseIds = [...new Set(action.courseIds)];
  if (courseIds.length === 0) return state;
  const now = Date.now();
  if (state.plans.length === 1 && state.plans[0].courseIds.length === 0) {
    const imported = {
      ...state.plans[0],
      name: action.name,
      updatedAt: now,
      courseIds,
    };
    return { plans: [imported], activePlanId: imported.id };
  }
  if (state.plans.length >= 10) return state;
  const imported: Plan = {
    id: genId(),
    name: action.name,
    createdAt: now,
    updatedAt: now,
    courseIds,
  };
  return { plans: [...state.plans, imported], activePlanId: imported.id };
}
```

- [ ] **Step 4: Run reducer and existing storage tests**

Run: `pnpm test -- src/store/plansReducer.test.ts src/utils/planSeed.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/store/plansReducer.ts src/store/plansReducer.test.ts
git commit -m "feat: import shared plans atomically"
```

---

### Task 3: Sender share modal and action placement

**Files:**
- Create: `src/components/SharePlanModal.tsx`
- Modify: `src/components/PlanSwitcher.tsx`
- Modify: `src/components/icons.tsx`
- Modify: `src/index.css`
- Create: `src/components/SharedPlanUI.test.ts`

**Interfaces:**
- Consumes: `buildSharedPlanUrl`, active `Plan`, `semesterKey`, and `semesterName`.
- Produces: a create/share/delete/more toolbar and sender modal.

- [ ] **Step 1: Write a failing source contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const switcher = readFileSync(new URL('./PlanSwitcher.tsx', import.meta.url), 'utf8');
const sender = readFileSync(new URL('./SharePlanModal.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('shared-plan sender UI', () => {
  it('places share between create and delete and disables empty plans', () => {
    const plus = switcher.indexOf('aria-label="新建方案"');
    const share = switcher.indexOf('aria-label="分享当前方案"');
    const remove = switcher.indexOf('aria-label="删除当前方案"');
    expect(plus).toBeGreaterThan(-1);
    expect(share).toBeGreaterThan(plus);
    expect(remove).toBeGreaterThan(share);
    expect(switcher).toContain('activePlan.courseIds.length === 0');
  });

  it('offers copy and optional native share without QR', () => {
    expect(sender).toContain('复制链接');
    expect(sender).toContain('navigator.share');
    expect(sender).not.toContain('二维码');
  });

  it('keeps the selector compact and truncates long names', () => {
    expect(styles).toContain('.plan-switcher__select');
    expect(styles).toMatch(/\.plan-switcher__select[^}]*min-width:\s*0/s);
    expect(switcher).toContain('title={activePlan?.name}');
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm test -- src/components/SharedPlanUI.test.ts`

Expected: FAIL because `SharePlanModal.tsx` and the share action do not exist.

- [ ] **Step 3: Add the share icon and sender modal**

```tsx
export function ShareIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="18" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
```

`SharePlanModal` computes the link with `buildSharedPlanUrl`, renders the privacy note and read-only text area, calls `navigator.clipboard.writeText()`, and only renders the system-share button when `typeof navigator.share === 'function'`.

- [ ] **Step 4: Wire the share button and compact selector**

Add `semesterKey` and `semesterName` props to `PlanSwitcher`, render the new button between create and delete, and render:

```tsx
<SharePlanModal
  open={shareOpen}
  plan={activePlan}
  semesterKey={semesterKey}
  semesterName={semesterName}
  onClose={() => setShareOpen(false)}
/>
```

Keep the grid layout and add a bounded selector rule for desktop while retaining the mobile `minmax(0, 1fr)` behavior.

- [ ] **Step 5: Run sender UI tests and build**

Run: `pnpm test -- src/components/SharedPlanUI.test.ts && pnpm build`

Expected: tests PASS and TypeScript/Vite build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add src/components/SharePlanModal.tsx src/components/PlanSwitcher.tsx src/components/icons.tsx src/index.css src/components/SharedPlanUI.test.ts
git commit -m "feat: add plan sharing controls"
```

---

### Task 4: Receiver import orchestration and preview

**Files:**
- Create: `src/hooks/useSharedPlanImport.ts`
- Create: `src/hooks/useSharedPlanImport.test.ts`
- Create: `src/components/SharedPlanImportModal.tsx`
- Modify: `src/data/SemesterCatalogContext.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/SharedPlanUI.test.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `parseSharedPlanFragment`, manifest, current semester, `courseMap`, plans state, dispatch, and `switchSemester`.
- Produces: `{ state, confirmImport, closeImport }`, where state is closed, error, switching, or preview.

- [ ] **Step 1: Write failing preview derivation tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveSharedPlanPreview } from './useSharedPlanImport';

describe('deriveSharedPlanPreview', () => {
  const payload = {
    version: 1 as const,
    semesterKey: '2026-fall',
    name: '无早八',
    courseIds: ['A.01', 'MISSING.01'],
  };
  const courseMap = new Map([
    ['A.01', { id: 'A.01', courseName: '高等数学' }],
  ]);

  it('separates valid and missing course IDs', () => {
    const preview = deriveSharedPlanPreview(payload, courseMap, []);
    expect(preview.validCourses.map((course) => course.id)).toEqual(['A.01']);
    expect(preview.missingCourseIds).toEqual(['MISSING.01']);
    expect(preview.canImport).toBe(true);
  });

  it('blocks import when every course is missing', () => {
    const preview = deriveSharedPlanPreview(
      { ...payload, courseIds: ['MISSING.01'] },
      new Map(),
      [],
    );
    expect(preview.canImport).toBe(false);
    expect(preview.blockReason).toContain('全部失效');
  });

  it('blocks an eleventh plan but allows reuse of one empty plan', () => {
    const tenPlans = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      name: `P${index}`,
      createdAt: 1,
      updatedAt: 1,
      courseIds: ['A'],
    }));
    expect(deriveSharedPlanPreview(payload, courseMap, tenPlans).canImport).toBe(false);
    const empty = [{ id: '1', name: '空白', createdAt: 1, updatedAt: 1, courseIds: [] }];
    expect(deriveSharedPlanPreview(payload, courseMap, empty).canImport).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- src/hooks/useSharedPlanImport.test.ts`

Expected: FAIL because the hook module and derivation function do not exist.

- [ ] **Step 3: Implement preview derivation and hook state machine**

Expose `deriveSharedPlanPreview()` as a pure function. Implement the hook with:

```ts
type SharedPlanImportState =
  | { kind: 'closed' }
  | { kind: 'switching'; semesterKey: string }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; preview: SharedPlanPreview };
```

On a successful parsed fragment:

- Reject a semester key absent from `manifest.semesters`.
- Call `switchSemester()` once when the current semester differs.
- Derive preview only after the target catalog is active.
- On confirm, dispatch `importPlan` with the resolved name and valid course IDs.
- On confirm, cancel, or error close, call `clearSharedPlanFragment()` and set the state to closed.

- [ ] **Step 4: Prefer the shared semester on initial catalog load**

In `SemesterCatalogContext`, parse `window.location.hash` after loading the manifest. If it contains a structurally valid shared payload, pass its semester key to `selectInitialSemester`; otherwise use the stored semester. This prevents an unnecessary initial catalog request before import preview.

- [ ] **Step 5: Add receiver modal and App wiring**

`SharedPlanImportModal` renders:

- Source plan name and semester.
- Valid course rows containing course name and classroom ID.
- Warning section for missing IDs.
- Disabled primary action with `blockReason` when import is not allowed.

In `MainArea`, pass existing `manifest`, `catalog.semester.key`, `courseMap`, `plansState`, `dispatch`, and `switchSemester` to the hook, then render the receiver modal once near the other top-level modals.

- [ ] **Step 6: Run receiver, reducer, and UI tests**

Run: `pnpm test -- src/hooks/useSharedPlanImport.test.ts src/store/plansReducer.test.ts src/components/SharedPlanUI.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/hooks/useSharedPlanImport.ts src/hooks/useSharedPlanImport.test.ts src/components/SharedPlanImportModal.tsx src/data/SemesterCatalogContext.tsx src/App.tsx src/components/SharedPlanUI.test.ts src/index.css
git commit -m "feat: preview and import shared plans"
```

---

### Task 5: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: implementation files only if verification finds a defect.

**Interfaces:**
- Consumes: all feature work.
- Produces: verified user documentation and release-ready build.

- [ ] **Step 1: Document the feature**

Add to the README feature list:

```markdown
- **方案分享**：把当前学期的选课方案生成无后端快照链接；接收方可预览并导入仍然有效的课堂，链接不包含占位时段或排课偏好
```

- [ ] **Step 2: Run all automated checks**

Run:

```powershell
pnpm test
pnpm lint
pnpm build
```

Expected: all Vitest files pass, oxlint exits 0, and TypeScript/Vite production build succeeds.

- [ ] **Step 3: Run browser acceptance checks**

Start the app with `pnpm dev`, then verify at desktop and mobile widths:

1. The toolbar order is create, share, delete, more.
2. The selector remains readable and long names ellipsize.
3. Empty plans cannot be shared.
4. A copied link opens the target semester and preview.
5. Partial missing IDs are warned and valid IDs import.
6. Import reuses one empty plan or creates and activates a new plan.
7. Import/cancel clears `#plan`.
8. Light and dark modal layouts remain readable.

- [ ] **Step 4: Inspect the final diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional feature files remain.

- [ ] **Step 5: Commit documentation and final fixes**

```powershell
git add README.md
git commit -m "docs: describe plan sharing"
```
