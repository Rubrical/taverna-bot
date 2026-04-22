import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LOGS_CONNECTION } from '../database/database.constants.js';
import {
  SystemLog,
  SystemLogSchema,
} from './domain/schemas/system-log.schema.js';
import { LogProcessorController } from './infrastructure/log-processor.controller.js';
import { LogProcessorRepository } from './infrastructure/log-processor.repository.js';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: SystemLog.name, schema: SystemLogSchema }],
      LOGS_CONNECTION,
    ),
  ],
  controllers: [LogProcessorController],
  providers: [LogProcessorRepository],
})
export class LogProcessorModule {}
