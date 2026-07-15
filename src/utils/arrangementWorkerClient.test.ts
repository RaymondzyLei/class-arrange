import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseGroup } from '@/types';
import { enumerateArrangementsExact } from './arrangementEngine';
import type { CustomScheduleSettings } from './customization';
import {
  createArrangementWorkerClient,
  type ArrangementWorkerLike,
} from './arrangementWorkerClient';
import type {
  ArrangementWorkerRequest,
  ArrangementWorkerResponse,
} from '@/workers/arrangementProtocol';

const SETTINGS: CustomScheduleSettings = {
  calculationMode: 'auto',
  preferHalfDay: false,
  preferFewerEarlyMornings: true,
  preferAvoidCampusTransfers: true,
  residentCampus: '本部',
  blockedSlots: [],
};

function group(courseCode: string, key: string): CourseGroup {
  return {
    courseCode,
    courseName: courseCode,
    schedule: [],
    fingerprint: key,
    sectionIds: [`${courseCode}.01`],
    teachers: [],
    sections: [],
    key,
  };
}

class FakeWorker implements ArrangementWorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly requests: ArrangementWorkerRequest[] = [];
  terminateCalls = 0;

  postMessage(message: ArrangementWorkerRequest): void {
    this.requests.push(message);
  }

  terminate(): void {
    this.terminateCalls += 1;
  }

  reply(message: ArrangementWorkerResponse): void {
    this.replyRaw(message);
  }

  replyRaw(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }

  crash(message: string): void {
    this.onerror?.({ message, error: new Error(message) } as ErrorEvent);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('arrangement Worker client', () => {
  it('posts a generation-tagged request and rehydrates result group keys', async () => {
    const groups = [group('A', 'a'), group('B', 'b')];
    const worker = new FakeWorker();
    const client = createArrangementWorkerClient({ workerFactory: () => worker });

    const pending = client.calculate(groups, SETTINGS);

    expect(worker.requests).toEqual([{
      type: 'calculate',
      generation: 1,
      groups: [
        { courseCode: 'A', key: 'a', schedule: [], credits: 0, hours: 0 },
        { courseCode: 'B', key: 'b', schedule: [], credits: 0, hours: 0 },
      ],
      settings: {
        preferHalfDay: false,
        preferFewerEarlyMornings: true,
        preferAvoidCampusTransfers: true,
        residentCampus: '本部',
        blockedSlots: [],
      },
    }]);
    worker.reply({
      type: 'result',
      generation: 1,
      arrangements: [{
        id: 'a||b',
        groupKeys: ['a', 'b'],
        conflictCount: 2,
        courseCount: 2,
        totalCredits: 5,
        totalHours: 64,
      }],
    });

    const [result] = await pending;
    expect(result).toEqual({
      id: 'a||b',
      groups,
      conflictCount: 2,
      courseCount: 2,
      totalCredits: 5,
      totalHours: 64,
    });
    expect(result.groups[0]).toBe(groups[0]);
    expect(result.groups[1]).toBe(groups[1]);
    expect(worker.terminateCalls).toBe(1);
  });

  it('terminates and rejects superseded work, then ignores stale replies', async () => {
    const workers: FakeWorker[] = [];
    const client = createArrangementWorkerClient({
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
    });

    const stale = client.calculate([group('A', 'a')], SETTINGS);
    const staleHandler = workers[0].onmessage;
    const staleRejection = expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    const freshGroups = [group('B', 'b')];
    const fresh = client.calculate(freshGroups, SETTINGS);

    expect(workers[0].terminateCalls).toBe(1);
    expect(workers[1].requests[0].generation).toBe(2);
    staleHandler?.({
      data: {
        type: 'result',
        generation: 1,
        arrangements: [],
      },
    } as unknown as MessageEvent<ArrangementWorkerResponse>);
    workers[1].reply({
      type: 'result',
      generation: 1,
      arrangements: [],
    });
    workers[1].reply({
      type: 'result',
      generation: 2,
      arrangements: [{
        id: 'b',
        groupKeys: ['b'],
        conflictCount: 0,
        courseCount: 1,
        totalCredits: 0,
        totalHours: 0,
      }],
    });

    await staleRejection;
    await expect(fresh).resolves.toMatchObject([{ id: 'b', groups: freshGroups }]);
  });

  it('explicitly cancels active work with an AbortError', async () => {
    const worker = new FakeWorker();
    const client = createArrangementWorkerClient({ workerFactory: () => worker });
    const pending = client.calculate([group('A', 'a')], SETTINGS);

    client.cancel();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminateCalls).toBe(1);
  });

  it('rejects structured Worker errors and runtime Worker crashes', async () => {
    const protocolWorker = new FakeWorker();
    const protocolClient = createArrangementWorkerClient({
      workerFactory: () => protocolWorker,
    });
    const protocolFailure = protocolClient.calculate([group('A', 'a')], SETTINGS);
    protocolWorker.reply({
      type: 'error',
      generation: 1,
      message: 'enumeration failed',
    });
    await expect(protocolFailure).rejects.toThrow('enumeration failed');

    const crashedWorker = new FakeWorker();
    const crashedClient = createArrangementWorkerClient({
      workerFactory: () => crashedWorker,
    });
    const runtimeFailure = crashedClient.calculate([group('A', 'a')], SETTINGS);
    crashedWorker.crash('worker crashed');
    await expect(runtimeFailure).rejects.toThrow('worker crashed');
    expect(crashedWorker.terminateCalls).toBe(1);
  });

  it('rejects a result that references an unknown group key', async () => {
    const worker = new FakeWorker();
    const client = createArrangementWorkerClient({ workerFactory: () => worker });
    const pending = client.calculate([group('A', 'a')], SETTINGS);
    worker.reply({
      type: 'result',
      generation: 1,
      arrangements: [{
        id: 'missing',
        groupKeys: ['missing'],
        conflictCount: 0,
        courseCount: 1,
        totalCredits: 0,
        totalHours: 0,
      }],
    });

    await expect(pending).rejects.toThrow('unknown group key: missing');
    expect(worker.terminateCalls).toBe(1);
  });

  it('rejects malformed same-generation Worker replies instead of resolving or hanging', async () => {
    const malformedReplies: unknown[] = [
      null,
      { type: 'result', arrangements: [] },
      { type: 'unexpected', generation: 1, arrangements: [] },
      {
        type: 'result',
        generation: 1,
        arrangements: [{ id: 'a', groupKeys: ['a'], conflictCount: 'zero' }],
      },
    ];
    for (const reply of malformedReplies) {
      const worker = new FakeWorker();
      const client = createArrangementWorkerClient({ workerFactory: () => worker });
      const pending = client.calculate([group('A', 'a')], SETTINGS);

      expect(() => worker.replyRaw(reply)).not.toThrow();
      await expect(pending).rejects.toThrow('Invalid Arrangement Worker response');
      expect(worker.terminateCalls).toBe(1);
    }
  });

  it('uses the exact deterministic enumerator in fallback mode and checks active tokens', async () => {
    const staleGroups = [group('A', 'a')];
    const freshGroups = [group('X', 'x2'), group('X', 'x1'), group('Y', 'y1')];
    const client = createArrangementWorkerClient({ workerFactory: null });

    const stale = client.calculate(staleGroups, SETTINGS);
    const staleRejection = expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    const fresh = client.calculate(freshGroups, SETTINGS);

    await staleRejection;
    const results = await fresh;
    expect(results).toEqual(enumerateArrangementsExact(freshGroups, SETTINGS));
    expect(results[0].groups.find(({ key }) => key === 'x1')).toBe(freshGroups[1]);
  });

  it('creates a Vite module Worker by default when Worker is available', async () => {
    const worker = new FakeWorker();
    let workerUrl = '';
    let workerOptions: WorkerOptions | undefined;
    vi.stubGlobal('Worker', class {
      constructor(url: string | URL, options?: WorkerOptions) {
        workerUrl = String(url);
        workerOptions = options;
        return worker;
      }
    });
    const client = createArrangementWorkerClient();

    const pending = client.calculate([], SETTINGS);

    expect(workerUrl).toContain('arrangement.worker.ts');
    expect(workerOptions).toEqual({ type: 'module' });
    worker.reply({ type: 'result', generation: 1, arrangements: [] });
    await expect(pending).resolves.toEqual([]);
  });
});
