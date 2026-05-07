import { Module } from '@nestjs/common';

import { AdminModule } from '../../admin/admin.module.js';
import { OnReady } from './on-ready.js';

@Module({
  imports: [AdminModule],
  providers: [OnReady],
})
export class EventsModule {}
