import type { Arrangement, CourseGroup } from '../types';
import {
  createArrangementWorkerRequest,
  executeArrangementWorkerRequest,
  type ArrangementResultDto,
  type ArrangementWorkerRequest,
  type ArrangementWorkerResponse,
} from '../workers/arrangementProtocol';
import type { CustomScheduleSettings } from './customization';
import type {
  ArrangementEnumerationResult,
  ArrangementResultMode,
} from './arrangementEngine';

export interface ArrangementWorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: ArrangementWorkerRequest): void;
  terminate(): void;
}

export type ArrangementWorkerFactory = () => ArrangementWorkerLike;

export interface ArrangementWorkerClient {
  calculate(
    groups: CourseGroup[],
    settings: CustomScheduleSettings,
  ): Promise<Arrangement[]>;
  calculateResults(
    groups: CourseGroup[],
    settings: CustomScheduleSettings,
    mode?: ArrangementResultMode,
  ): Promise<ArrangementEnumerationResult>;
  cancel(): void;
  dispose(): void;
}

export interface ArrangementWorkerClientOptions {
  workerFactory?: ArrangementWorkerFactory | null;
}

interface ActiveCalculation {
  generation: number;
  groupsByKey: Map<string, CourseGroup>;
  worker: ArrangementWorkerLike | null;
  resolve: (result: ArrangementEnumerationResult) => void;
  reject: (error: Error) => void;
}

function createDefaultWorker(): ArrangementWorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(
    new URL('../workers/arrangement.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as ArrangementWorkerLike;
}

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' && error ? error : fallbackMessage);
}

function createAbortError(): Error {
  const error = new Error('Arrangement calculation was cancelled');
  error.name = 'AbortError';
  return error;
}

function invalidWorkerResponse(): Error {
  return new Error('Invalid Arrangement Worker response');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function readResponseGeneration(value: unknown): number {
  if (!isRecord(value) || !Number.isSafeInteger(value.generation)) {
    throw invalidWorkerResponse();
  }
  return value.generation as number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseWorkerResponse(value: unknown): ArrangementWorkerResponse {
  if (!isRecord(value)) throw invalidWorkerResponse();
  const generation = readResponseGeneration(value);
  if (value.type === 'error') {
    if (typeof value.message !== 'string') throw invalidWorkerResponse();
    return { type: 'error', generation, message: value.message };
  }
  if (
    value.type !== 'result'
    || !Array.isArray(value.arrangements)
    || !Array.isArray(value.conflictFreePreview)
    || !Number.isSafeInteger(value.totalConflictFreeCount)
    || (value.totalConflictFreeCount as number) < 0
  ) {
    throw invalidWorkerResponse();
  }
  const parseArrangements = (items: unknown[]): ArrangementResultDto[] => items.map((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== 'string'
      || !Array.isArray(item.groupKeys)
      || !item.groupKeys.every((key) => typeof key === 'string')
      || !isFiniteNumber(item.conflictCount)
      || !isFiniteNumber(item.courseCount)
      || !isFiniteNumber(item.totalCredits)
      || !isFiniteNumber(item.totalHours)
    ) {
      throw invalidWorkerResponse();
    }
    return {
      id: item.id,
      groupKeys: item.groupKeys,
      conflictCount: item.conflictCount,
      courseCount: item.courseCount,
      totalCredits: item.totalCredits,
      totalHours: item.totalHours,
    };
  });
  return {
    type: 'result',
    generation,
    arrangements: parseArrangements(value.arrangements),
    conflictFreePreview: parseArrangements(value.conflictFreePreview),
    totalConflictFreeCount: value.totalConflictFreeCount as number,
  };
}

function rehydrateArrangement(
  dto: ArrangementResultDto,
  groupsByKey: Map<string, CourseGroup>,
): Arrangement {
  const groups = dto.groupKeys.map((key) => {
    const group = groupsByKey.get(key);
    if (!group) throw new Error(`Arrangement Worker returned unknown group key: ${key}`);
    return group;
  });
  return {
    id: dto.id,
    groups,
    conflictCount: dto.conflictCount,
    courseCount: dto.courseCount,
    totalCredits: dto.totalCredits,
    totalHours: dto.totalHours,
  };
}

class DefaultArrangementWorkerClient implements ArrangementWorkerClient {
  private generation = 0;
  private active: ActiveCalculation | null = null;
  private readonly workerFactory: (() => ArrangementWorkerLike | null) | null;

  constructor(options: ArrangementWorkerClientOptions) {
    this.workerFactory = options.workerFactory === undefined
      ? createDefaultWorker
      : options.workerFactory;
  }

  calculate(
    groups: CourseGroup[],
    settings: CustomScheduleSettings,
  ): Promise<Arrangement[]> {
    return this.calculateResults(groups, settings).then(({ arrangements }) => arrangements);
  }

  calculateResults(
    groups: CourseGroup[],
    settings: CustomScheduleSettings,
    mode: ArrangementResultMode = 'recommended',
  ): Promise<ArrangementEnumerationResult> {
    this.abortActive();
    const generation = ++this.generation;
    const groupsByKey = new Map(groups.map((group) => [group.key, group]));

    return new Promise((resolve, reject) => {
      const active: ActiveCalculation = {
        generation,
        groupsByKey,
        worker: null,
        resolve,
        reject,
      };
      this.active = active;

      let request: ArrangementWorkerRequest;
      try {
        request = createArrangementWorkerRequest(generation, groups, settings, mode);
      } catch (error) {
        this.rejectActive(active, toError(error, 'Unable to prepare arrangement calculation'));
        return;
      }

      let worker: ArrangementWorkerLike | null;
      try {
        worker = this.workerFactory?.() ?? null;
      } catch (error) {
        this.rejectActive(active, toError(error, 'Unable to start Arrangement Worker'));
        return;
      }

      if (!worker) {
        queueMicrotask(() => {
          if (this.active !== active) return;
          try {
            this.handleResponse(active, executeArrangementWorkerRequest(request));
          } catch (error) {
            this.rejectActive(active, toError(error, 'Arrangement calculation failed'));
          }
        });
        return;
      }

      active.worker = worker;
      worker.onmessage = ({ data }) => this.handleResponse(active, data);
      worker.onerror = (event) => {
        this.rejectActive(
          active,
          toError(event.error, event.message || 'Arrangement Worker failed'),
        );
      };
      try {
        worker.postMessage(request);
      } catch (error) {
        this.rejectActive(active, toError(error, 'Unable to message Arrangement Worker'));
      }
    });
  }

  cancel(): void {
    this.abortActive();
  }

  dispose(): void {
    this.abortActive();
  }

  private handleResponse(
    active: ActiveCalculation,
    value: unknown,
  ): void {
    if (this.active !== active) return;
    try {
      const generation = readResponseGeneration(value);
      if (generation !== active.generation) return;
      const response = parseWorkerResponse(value);
      if (response.type === 'error') throw new Error(response.message);
      const arrangements = response.arrangements.map((dto) =>
        rehydrateArrangement(dto, active.groupsByKey));
      const conflictFreePreview = response.conflictFreePreview.map((dto) =>
        rehydrateArrangement(dto, active.groupsByKey));
      this.resolveActive(active, {
        arrangements,
        conflictFreePreview,
        totalConflictFreeCount: response.totalConflictFreeCount,
      });
    } catch (error) {
      this.rejectActive(active, toError(error, 'Invalid Arrangement Worker response'));
    }
  }

  private resolveActive(
    active: ActiveCalculation,
    result: ArrangementEnumerationResult,
  ): void {
    if (!this.releaseActive(active)) return;
    active.resolve(result);
  }

  private rejectActive(active: ActiveCalculation, error: Error): void {
    if (!this.releaseActive(active)) return;
    active.reject(error);
  }

  private abortActive(): void {
    const active = this.active;
    if (!active || !this.releaseActive(active)) return;
    active.reject(createAbortError());
  }

  private releaseActive(active: ActiveCalculation): boolean {
    if (this.active !== active) return false;
    this.active = null;
    if (active.worker) {
      active.worker.onmessage = null;
      active.worker.onerror = null;
      active.worker.terminate();
    }
    return true;
  }
}

export function createArrangementWorkerClient(
  options: ArrangementWorkerClientOptions = {},
): ArrangementWorkerClient {
  return new DefaultArrangementWorkerClient(options);
}
