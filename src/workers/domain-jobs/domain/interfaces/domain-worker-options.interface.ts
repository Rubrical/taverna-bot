import type { DomainJobRetryOptions } from './domain-job-retry-options.interface.js';

export interface DomainWorkerOptions {
  readonly workerName: string;
  readonly queue: string;
  readonly retryQueue: string;
  readonly deadLetterQueue: string;
  readonly retry: DomainJobRetryOptions;
}
