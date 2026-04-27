import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LOGS_CONNECTION } from '../../infrastructure/database/database.constants';
import { SystemLog, SystemLogSchema } from './domain/schemas/system-log.schema';
import { LogProcessorController } from './infrastructure/log-processor.controller';
import { LogProcessorRepository } from './infrastructure/log-processor.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: SystemLog.name, schema: SystemLogSchema }], LOGS_CONNECTION)],
  controllers: [LogProcessorController],
  providers: [LogProcessorRepository],
})
export class LogProcessorModule {}
