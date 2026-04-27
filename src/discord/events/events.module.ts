import { Module } from '@nestjs/common';

import { OnReady } from './on-ready.js';

@Module({
  imports: [],
  providers: [OnReady],
})
export class EventsModule {}
