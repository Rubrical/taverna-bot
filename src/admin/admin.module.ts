import { Module } from '@nestjs/common';

import { BotStatusInfoService } from './application/bot-status-info.service.js';
import { LogsQueryService } from './application/logs-query.service.js';

@Module({
  providers: [BotStatusInfoService, LogsQueryService],
  exports: [BotStatusInfoService, LogsQueryService],
})
export class AdminModule {}
