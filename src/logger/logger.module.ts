import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SYSTEM_LOG_REPOSITORY } from './domain/interfaces/system-log-repository.interface.js';
import { SystemLog, SystemLogSchema } from './domain/schemas/system-log.schema.js';
import { LogPublisher } from './infrastructure/log-publisher.service.js';
import { SystemLogRepository } from './infrastructure/system-log.repository.js';
import { TavernaLogger } from './infrastructure/taverna-logger.service.js';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: SystemLog.name, schema: SystemLogSchema }])],
  providers: [
    LogPublisher,
    SystemLogRepository,
    TavernaLogger,
    {
      provide: SYSTEM_LOG_REPOSITORY,
      useExisting: SystemLogRepository,
    },
  ],
  exports: [SYSTEM_LOG_REPOSITORY, TavernaLogger],
})
export class LoggerModule {}
