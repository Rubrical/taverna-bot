import type { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import type { DomainCronJob } from '../../../src/workers/domain-jobs/domain/interfaces/domain-cron-job.interface';
import { DomainCronRunner } from '../../../src/workers/domain-jobs/infrastructure/domain-cron-runner.service';
import type { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service';

type SchedulerRegistryMock = {
  addCronJob: jest.Mock;
};

type LoggerMock = {
  setContext: jest.Mock;
  error: jest.Mock;
};

describe('DomainCronRunner', () => {
  let schedulerRegistry: SchedulerRegistryMock;
  let logger: LoggerMock;
  let startSpy: jest.SpiedFunction<typeof CronJob.prototype.start>;

  beforeEach(() => {
    schedulerRegistry = {
      addCronJob: jest.fn(),
    };
    logger = {
      setContext: jest.fn(),
      error: jest.fn(),
    };
    startSpy = jest.spyOn(CronJob.prototype, 'start').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register and start configured cron jobs', () => {
    const jobs: readonly DomainCronJob[] = [
      {
        name: 'test-cron',
        cronExpression: '* * * * *',
        run: jest.fn().mockResolvedValue(undefined),
      },
    ];
    const runner = new DomainCronRunner(
      schedulerRegistry as unknown as SchedulerRegistry,
      logger as unknown as TavernaLogger,
      jobs,
    );

    runner.onModuleInit();

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith('test-cron', expect.any(CronJob));
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('should execute the job and log failures without throwing', async () => {
    const run = jest.fn<Promise<void>, []>().mockRejectedValue(new Error('cron failed'));
    const job: DomainCronJob = {
      name: 'failing-cron',
      cronExpression: '* * * * *',
      run,
    };
    const runner = new DomainCronRunner(
      schedulerRegistry as unknown as SchedulerRegistry,
      logger as unknown as TavernaLogger,
      [job],
    );

    await (runner as unknown as { execute(job: DomainCronJob): Promise<void> }).execute(job);

    expect(run).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Domain cron job failed: failing-cron',
      expect.any(Error),
      expect.objectContaining({
        jobName: 'failing-cron',
        cronExpression: '* * * * *',
      }),
    );
  });
});
