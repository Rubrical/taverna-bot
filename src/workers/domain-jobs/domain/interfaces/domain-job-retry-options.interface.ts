export interface DomainJobRetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxDelayMs: number;
}
