import { Module } from '@nestjs/common';
import { BotStatusInfoService } from './application/bot-status-info.service';

@Module({
  providers: [BotStatusInfoService]
})
export class AdminModule {}
