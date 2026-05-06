import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LOG_PROCESSOR_REPOSITORY } from './domain/interfaces/log-processor-repository.interface.js';
import { SystemLog, SystemLogSchema } from './domain/schemas/system-log.schema.js';
import { LogProcessorController } from './infrastructure/log-processor.controller.js';
import { LogProcessorRepository } from './infrastructure/log-processor.repository.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: SystemLog.name, schema: SystemLogSchema }])],
  controllers: [LogProcessorController],
  providers: [
    LogProcessorRepository,
    {
      provide: LOG_PROCESSOR_REPOSITORY,
      useExisting: LogProcessorRepository,
    },
  ],
})
export class LogProcessorModule {}
