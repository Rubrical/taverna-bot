import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import { DOMAIN_CRON_JOBS } from '../domain/domain-job-tokens.js';
import { DomainJobUnknownError } from '../domain/errors/domain-job-unknown.error.js';
import type { DomainCronJob } from '../domain/interfaces/domain-cron-job.interface.js';

@Injectable()
export class DomainCronRunner implements OnModuleInit {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly logger: TavernaLogger,
    @Optional()
    @Inject(DOMAIN_CRON_JOBS)
    private readonly jobs: readonly DomainCronJob[] = [],
  ) {
    this.logger.setContext(DomainCronRunner.name);
  }

  onModuleInit(): void {
    for (const job of this.jobs) {
      const cronJob = new CronJob(job.cronExpression, () => {
        void this.execute(job);
      });

      this.schedulerRegistry.addCronJob(job.name, cronJob);
      cronJob.start();
    }
  }

  private async execute(job: DomainCronJob): Promise<void> {
    try {
      await job.run();
    } catch (error: unknown) {
      this.logger.error(`Domain cron job failed: ${job.name}`, this.toError(error), {
        jobName: job.name,
        cronExpression: job.cronExpression,
      });
    }
  }

  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new DomainJobUnknownError(String(error));
  }
}
