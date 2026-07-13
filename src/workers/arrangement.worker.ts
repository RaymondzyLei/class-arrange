import {
  executeArrangementWorkerRequest,
  type ArrangementWorkerRequest,
  type ArrangementWorkerResponse,
} from './arrangementProtocol';

interface ArrangementWorkerScope {
  onmessage: ((event: MessageEvent<ArrangementWorkerRequest>) => void) | null;
  postMessage(message: ArrangementWorkerResponse): void;
}

const workerScope = self as unknown as ArrangementWorkerScope;

workerScope.onmessage = ({ data: request }) => {
  try {
    workerScope.postMessage(executeArrangementWorkerRequest(request));
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      generation: request.generation,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
