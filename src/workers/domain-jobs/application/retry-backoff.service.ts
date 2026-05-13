import { Injectable } from '@nestjs/common';

import type { DomainJobRetryOptions } from '../domain/interfaces/domain-job-retry-options.interface.js';

@Injectable()
export class RetryBackoffService {
  calculateDelayMs(attempt: number, options: DomainJobRetryOptions): number {
    const normalizedAttempt = Math.max(1, attempt);
    const exponent = normalizedAttempt - 1;
    const calculatedDelay = options.baseDelayMs * options.backoffMultiplier ** exponent;

    return Math.min(calculatedDelay, options.maxDelayMs);
  }
}
