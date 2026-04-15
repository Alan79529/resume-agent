export interface SingleRunLock {
  tryAcquire(runId: string): boolean;
  release(runId: string): void;
  isBusy(): boolean;
  currentRunId(): string | null;
}

export function createSingleRunLock(): SingleRunLock {
  let activeRunId: string | null = null;

  return {
    tryAcquire(runId: string): boolean {
      if (activeRunId !== null) {
        return false;
      }
      activeRunId = runId;
      return true;
    },
    release(runId: string): void {
      if (activeRunId === runId) {
        activeRunId = null;
      }
    },
    isBusy(): boolean {
      return activeRunId !== null;
    },
    currentRunId(): string | null {
      return activeRunId;
    },
  };
}
