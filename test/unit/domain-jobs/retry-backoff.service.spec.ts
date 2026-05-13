import { RetryBackoffService } from '../../../src/workers/domain-jobs/application/retry-backoff.service';
import type { DomainJobRetryOptions } from '../../../src/workers/domain-jobs/domain/interfaces/domain-job-retry-options.interface';

describe('RetryBackoffService', () => {
  const options: DomainJobRetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 1_000,
    backoffMultiplier: 2,
    maxDelayMs: 5_000,
  };

  let service: RetryBackoffService;

  beforeEach(() => {
    service = new RetryBackoffService();
  });

  it('should use base delay for the first failed attempt', () => {
    expect(service.calculateDelayMs(1, options)).toBe(1_000);
  });

  it('should multiply delay by the configured backoff multiplier', () => {
    expect(service.calculateDelayMs(2, options)).toBe(2_000);
    expect(service.calculateDelayMs(3, options)).toBe(4_000);
  });

  it('should cap delay at the configured max delay', () => {
    expect(service.calculateDelayMs(5, options)).toBe(5_000);
  });
});
