import { Module } from '@nestjs/common';
import { LogProcessorModule } from './log-processor/log-processor.module';

@Module({
  imports: [LogProcessorModule],
})
export class WorkersModule {}
