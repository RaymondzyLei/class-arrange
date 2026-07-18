import { describe, expect, it } from 'vitest';
import type {
  Arrangement,
  ArrangementFavoritePreferences,
  CourseGroup,
} from '@/types';
import type { CustomScheduleSettings } from './customization';
import {
  calculationActionLabel,
  calculationInputKey,
  canStartArrangementCalculation,
  completeArrangementCalculation,
  createArrangementCalculationState,
  failArrangementCalculation,
  recoverCancelledArrangementCalculation,
  resolveSelectedArrangementId,
  shouldSynchronizeArrangementCalculationProjection,
  shouldAutomaticallyCalculate,
  startArrangementCalculation,
  syncArrangementCalculationInputs,
} from './arrangementCalculationState';

function settings(
  overrides: Partial<CustomScheduleSettings> = {},
): CustomScheduleSettings {
  return {
    calculationMode: 'manual',
    arrangementDisplayCount: 8,
    mergeAllTimeGroups: false,
    preferHalfDay: false,
    preferFewerEarlyMornings: true,
    preferAvoidCampusTransfers: true,
    residentCampus: '本部',
    blockedSlots: [],
    ...overrides,
  };
}

function group(courseCode: string, key: string, sectionIds = [`${courseCode}.01`]): CourseGroup {
  return {
    courseCode,
    courseName: courseCode,
    schedule: [],
    fingerprint: key,
    sectionIds,
    teachers: [],
    sections: [],
    key,
  };
}

function arrangement(id: string, groups: CourseGroup[]): Arrangement {
  return {
    id,
    groups,
    conflictCount: 0,
    courseCount: groups.length,
    totalCredits: 0,
    totalHours: 0,
  };
}

describe('arrangement calculation input identity', () => {
  it('canonicalizes favorite arrays without mutating caller input', () => {
    const groups = [group('A', 'a')];
    const unordered: ArrangementFavoritePreferences = {
      arrangementIds: ['b', 'a'],
      timeGroupKeys: ['g2', 'g1'],
      sectionIds: ['S.02', 'S.01'],
    };
    const original = structuredClone(unordered);

    const key = calculationInputKey(groups, settings(), unordered);
    expect(key).toBe(calculationInputKey(
      groups,
      settings(),
      {
        arrangementIds: ['a', 'b'],
        timeGroupKeys: ['g1', 'g2'],
        sectionIds: ['S.01', 'S.02'],
      },
    ));
    expect(JSON.parse(key).favorites).toEqual({
      arrangementIds: ['a', 'b'],
      timeGroupKeys: ['g1', 'g2'],
      sectionIds: ['S.01', 'S.02'],
    });
    expect(unordered).toEqual(original);
  });

  it('changes when a favorite is added or removed', () => {
    const groups = [group('A', 'a')];
    const empty = { arrangementIds: [], timeGroupKeys: [], sectionIds: [] };
    const favorite = { ...empty, sectionIds: ['A.01'] };

    expect(calculationInputKey(groups, settings(), empty))
      .not.toBe(calculationInputKey(groups, settings(), favorite));
  });

  it('tracks calculation inputs but excludes calculation mode', () => {
    const groups = [group('A', 'a')];
    const automatic = settings({ calculationMode: 'auto' });
    const manual = settings({ calculationMode: 'manual' });
    expect(calculationInputKey(groups, automatic)).toBe(calculationInputKey(groups, manual));
    expect(calculationInputKey(groups, automatic)).not.toBe(calculationInputKey(
      groups,
      settings({ calculationMode: 'auto', preferHalfDay: true }),
    ));
    expect(calculationInputKey(groups, automatic)).not.toBe(calculationInputKey(
      groups,
      settings({ calculationMode: 'auto', blockedSlots: ['1-1'] }),
    ));
    expect(calculationInputKey(groups, automatic)).not.toBe(calculationInputKey(
      groups,
      settings({ preferAvoidCampusTransfers: false }),
    ));
    expect(calculationInputKey(groups, automatic)).not.toBe(calculationInputKey(
      groups,
      settings({ residentCampus: '高新区' }),
    ));
    expect(calculationInputKey(groups, automatic)).not.toBe(calculationInputKey(
      groups,
      settings({ arrangementDisplayCount: 12 }),
    ));
    expect(calculationInputKey(groups, automatic)).toBe(calculationInputKey(
      groups,
      settings({ mergeAllTimeGroups: true }),
    ));
    expect(calculationInputKey(groups, automatic)).not.toBe(calculationInputKey(
      [group('A', 'a', ['A.02'])],
      automatic,
    ));
  });
});

describe('arrangement calculation state', () => {
  it('keeps the committed favorite snapshot while changed favorites make the draft dirty', () => {
    const groups = [group('A', 'a')];
    const committedFavorites: ArrangementFavoritePreferences = {
      arrangementIds: ['a'],
      timeGroupKeys: [],
      sectionIds: ['A.01'],
    };
    const nextFavorites: ArrangementFavoritePreferences = {
      arrangementIds: [],
      timeGroupKeys: ['a'],
      sectionIds: [],
    };
    const result = [arrangement('a', groups)];
    let state = createArrangementCalculationState(
      'fall:plan-a',
      groups,
      settings(),
      committedFavorites,
    );
    state = completeArrangementCalculation(startArrangementCalculation(state, 1), 1, result);
    state = syncArrangementCalculationInputs(
      state,
      'fall:plan-a',
      groups,
      settings(),
      nextFavorites,
    );

    committedFavorites.arrangementIds.push('changed');
    nextFavorites.timeGroupKeys.push('changed');
    expect(state.phase).toBe('dirty');
    expect(state.committed?.favorites).toEqual({
      arrangementIds: ['a'],
      timeGroupKeys: [],
      sectionIds: ['A.01'],
    });
    expect(state.committed?.arrangements).toEqual(result);
    expect(state.draft.favorites).toEqual({
      arrangementIds: [],
      timeGroupKeys: ['a'],
      sectionIds: [],
    });
  });

  it('commits recommended arrangements with the conflict-free preview and total', () => {
    const groups = [group('A', 'a')];
    const recommended = [arrangement('a', groups)];
    let state = createArrangementCalculationState('fall:plan-a', groups, settings());
    state = completeArrangementCalculation(
      startArrangementCalculation(state, 1),
      1,
      {
        arrangements: recommended,
        conflictFreePreview: recommended,
        totalConflictFreeCount: 123,
      },
    );

    expect(state.committed?.arrangements).toEqual(recommended);
    expect(state.committed?.conflictFreePreview).toEqual(recommended);
    expect(state.committed?.totalConflictFreeCount).toBe(123);
  });

  it('starts empty without inputs and dirty with inputs', () => {
    const empty = createArrangementCalculationState('fall:plan-a', [], settings());
    const dirty = createArrangementCalculationState(
      'fall:plan-a',
      [group('A', 'a')],
      settings(),
    );

    expect(empty.phase).toBe('empty');
    expect(empty.committed).toBeNull();
    expect(dirty.phase).toBe('dirty');
    expect(shouldAutomaticallyCalculate(dirty)).toBe(false);
    expect(shouldAutomaticallyCalculate(syncArrangementCalculationInputs(
      dirty,
      'fall:plan-a',
      dirty.draft.groups,
      settings({ calculationMode: 'auto' }),
    ))).toBe(true);
  });

  it('retains the committed snapshot while manual inputs become dirty', () => {
    const oldGroups = [group('A', 'a')];
    const oldSettings = settings({ blockedSlots: ['1-1'] });
    const firstResult = [arrangement('a', oldGroups)];
    let state = createArrangementCalculationState('fall:plan-a', oldGroups, oldSettings);
    state = startArrangementCalculation(state, 1);
    state = completeArrangementCalculation(state, 1, firstResult);

    const nextGroups = [group('A', 'a'), group('B', 'b')];
    state = syncArrangementCalculationInputs(
      state,
      'fall:plan-a',
      nextGroups,
      settings({ blockedSlots: ['2-2'] }),
    );

    expect(state.phase).toBe('dirty');
    expect(state.committed?.groups).toEqual(oldGroups);
    expect(state.committed?.settings.blockedSlots).toEqual(['1-1']);
    expect(state.committed?.arrangements).toEqual(firstResult);
    expect(state.draft.groups).toEqual(nextGroups);
    expect(state.draft.settings.blockedSlots).toEqual(['2-2']);
    expect(calculationActionLabel(state)).toBe('重新计算');
  });

  it('retains an old snapshot after all courses are removed, then commits an empty result', () => {
    const groups = [group('A', 'a')];
    let state = createArrangementCalculationState('fall:plan-a', groups, settings());
    state = completeArrangementCalculation(startArrangementCalculation(state, 1), 1, [
      arrangement('a', groups),
    ]);
    state = syncArrangementCalculationInputs(state, 'fall:plan-a', [], settings());

    expect(state.phase).toBe('dirty');
    expect(state.committed?.arrangements).toHaveLength(1);
    expect(canStartArrangementCalculation(state)).toBe(true);

    state = completeArrangementCalculation(startArrangementCalculation(state, 2), 2, []);
    expect(state.phase).toBe('ready');
    expect(state.committed?.groups).toEqual([]);
    expect(state.committed?.arrangements).toEqual([]);
  });

  it('ignores stale success and failure generations', () => {
    const groups = [group('A', 'a')];
    let state = startArrangementCalculation(
      createArrangementCalculationState('fall:plan-a', groups, settings()),
      1,
    );
    state = syncArrangementCalculationInputs(
      state,
      'fall:plan-a',
      [group('A', 'a'), group('B', 'b')],
      settings(),
    );
    const dirty = state;
    expect(completeArrangementCalculation(state, 1, [arrangement('stale', groups)]))
      .toBe(dirty);

    state = startArrangementCalculation(state, 2);
    expect(failArrangementCalculation(state, 1, 'stale error')).toBe(state);
    state = completeArrangementCalculation(state, 2, [arrangement('fresh', state.draft.groups)]);
    expect(state.phase).toBe('ready');
    expect(state.committed?.arrangements[0].id).toBe('fresh');
  });

  it('recovers a still-active cancelled generation without losing its snapshot', () => {
    const groups = [group('A', 'a')];
    let state = createArrangementCalculationState('fall:plan-a', groups, settings());
    state = completeArrangementCalculation(startArrangementCalculation(state, 1), 1, [
      arrangement('a', groups),
    ]);
    state = syncArrangementCalculationInputs(
      state,
      'fall:plan-a',
      groups,
      settings({ preferHalfDay: true }),
    );
    state = startArrangementCalculation(state, 2);

    const recovered = recoverCancelledArrangementCalculation(state, 2);
    expect(recovered.phase).toBe('dirty');
    expect(recovered.activeGeneration).toBeNull();
    expect(recovered.committed?.arrangements[0].id).toBe('a');
    expect(recoverCancelledArrangementCalculation(state, 1)).toBe(state);
  });

  it('retains the previous snapshot and exposes a retryable error', () => {
    const groups = [group('A', 'a')];
    let state = createArrangementCalculationState('fall:plan-a', groups, settings());
    state = completeArrangementCalculation(startArrangementCalculation(state, 1), 1, [
      arrangement('a', groups),
    ]);
    state = syncArrangementCalculationInputs(
      state,
      'fall:plan-a',
      groups,
      settings({ preferHalfDay: true }),
    );
    state = failArrangementCalculation(startArrangementCalculation(state, 2), 2, 'boom');

    expect(state.phase).toBe('error');
    expect(state.error).toBe('boom');
    expect(state.committed?.arrangements[0].id).toBe('a');
    expect(canStartArrangementCalculation(state)).toBe(true);
  });

  it('hard-resets snapshots when plan or semester scope changes', () => {
    const groups = [group('A', 'a')];
    let state = createArrangementCalculationState('fall:plan-a', groups, settings());
    state = completeArrangementCalculation(startArrangementCalculation(state, 1), 1, [
      arrangement('a', groups),
    ]);

    state = syncArrangementCalculationInputs(
      state,
      'summer:plan-b',
      [group('B', 'b')],
      settings(),
    );
    expect(state.phase).toBe('dirty');
    expect(state.committed).toBeNull();
    expect(calculationActionLabel(state)).toBe('开始排课');

    state = syncArrangementCalculationInputs(state, 'summer:plan-b', [], settings());
    expect(state.phase).toBe('empty');
    expect(canStartArrangementCalculation(state)).toBe(false);
  });

  it('does not dirty a ready snapshot when only calculation mode changes', () => {
    const groups = [group('A', 'a')];
    let state = createArrangementCalculationState(
      'fall:plan-a',
      groups,
      settings({ calculationMode: 'auto' }),
    );
    state = completeArrangementCalculation(startArrangementCalculation(state, 1), 1, [
      arrangement('a', groups),
    ]);
    const committed = state.committed;

    state = syncArrangementCalculationInputs(
      state,
      'fall:plan-a',
      groups,
      settings({ calculationMode: 'manual' }),
    );
    expect(state.phase).toBe('ready');
    expect(state.committed).toBe(committed);
    expect(state.draft.settings.calculationMode).toBe('manual');
  });

  it('does not synchronize a stale mode-only projection over a newer completion', () => {
    const groups = [group('A', 'a')];
    const rendered = startArrangementCalculation(
      createArrangementCalculationState(
        'fall:plan-a',
        groups,
        settings({ calculationMode: 'auto' }),
      ),
      1,
    );
    const projected = syncArrangementCalculationInputs(
      rendered,
      'fall:plan-a',
      groups,
      settings({ calculationMode: 'manual' }),
    );

    expect(projected.phase).toBe('calculating');
    expect(shouldSynchronizeArrangementCalculationProjection(
      rendered,
      projected,
      projected,
    )).toBe(true);

    const completed = completeArrangementCalculation(projected, 1, [
      arrangement('a', groups),
    ]);
    expect(completed.phase).toBe('ready');
    expect(shouldSynchronizeArrangementCalculationProjection(
      rendered,
      projected,
      completed,
    )).toBe(false);
  });
});

describe('arrangement selection across commits', () => {
  it('selects the newly ranked first result after every successful recalculation', () => {
    const groups = [group('A', 'a')];
    const next = [arrangement('first', groups), arrangement('kept', groups)];
    expect(resolveSelectedArrangementId('kept', next)).toBe('first');
    expect(resolveSelectedArrangementId('gone', next)).toBe('first');
    expect(resolveSelectedArrangementId(null, next)).toBe('first');
    expect(resolveSelectedArrangementId('gone', [])).toBeNull();
  });
});
