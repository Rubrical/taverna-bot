import { Module } from '@nestjs/common';

import { AdminModule } from '../../admin/admin.module.js';
import { LogsCommand } from './admin/logs.command.js';
import { BotInfoCommand } from './bot/bot-info.command.js';
import { BotStatusCommand } from './bot/bot-status.command.js';
import { CommandLoggingInterceptor } from './interceptors/command-logging-interceptor.js';
import { PingCommand } from './ping.command.js';

@Module({
  imports: [AdminModule],
  providers: [PingCommand, BotInfoCommand, BotStatusCommand, CommandLoggingInterceptor, LogsCommand],
})
export class CommandsModule {}
