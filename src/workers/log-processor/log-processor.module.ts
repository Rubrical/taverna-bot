import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SystemLog, SystemLogSchema } from './domain/schemas/system-log.schema.js';
import { LogProcessorController } from './infrastructure/log-processor.controller.js';
import { LogProcessorRepository } from './infrastructure/log-processor.repository.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: SystemLog.name, schema: SystemLogSchema }])],
  controllers: [LogProcessorController],
  providers: [LogProcessorRepository],
})
export class LogProcessorModule {}
