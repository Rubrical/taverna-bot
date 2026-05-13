import { Module } from '@nestjs/common';

import { DomainJobsModule } from './domain-jobs/domain-jobs.module.js';
import { LogProcessorModule } from './log-processor/log-processor.module.js';

@Module({
  imports: [DomainJobsModule, LogProcessorModule],
})
export class WorkersModule {}
