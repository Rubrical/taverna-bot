export interface DomainWorkerFailure<TPayload = unknown> {
  readonly payload: TPayload;
  readonly error: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
  readonly metadata: {
    readonly workerName: string;
    readonly queue: string;
    readonly attempts: number;
    readonly failedAt: string;
  };
}
