import { Module } from '@nestjs/common';

import { BotStatusInfoService } from './application/bot-status-info.service.js';

@Module({
  providers: [BotStatusInfoService],
  exports: [BotStatusInfoService],
})
export class AdminModule {}
