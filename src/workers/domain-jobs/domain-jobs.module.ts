import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { RetryBackoffService } from './application/retry-backoff.service.js';
import { DOMAIN_CRON_JOBS } from './domain/domain-job-tokens.js';
import { DomainCronRunner } from './infrastructure/domain-cron-runner.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    RetryBackoffService,
    DomainCronRunner,
    {
      provide: DOMAIN_CRON_JOBS,
      // All cron jobs classes should live in here
      useValue: [],
    },
  ],
  exports: [RetryBackoffService, DOMAIN_CRON_JOBS],
})
export class DomainJobsModule {}
