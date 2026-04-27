import { Module } from '@nestjs/common';
import { OnReady } from './on-ready';

@Module({
  imports: [],
  exports: [OnReady],
})
export class EventsModule {}
