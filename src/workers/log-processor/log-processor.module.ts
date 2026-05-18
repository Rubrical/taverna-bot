import { Module } from '@nestjs/common';

import { LogProcessorController } from './infrastructure/log-processor.controller.js';

@Module({
  controllers: [LogProcessorController],
})
export class LogProcessorModule {}
