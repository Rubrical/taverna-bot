import { Module } from '@nestjs/common';

import { AdminModule } from '../../admin/admin.module.js';
import { RpgModule } from '../../rpg/rpg.module.js';
import { LogsCommand } from './admin/logs.command.js';
import { BotInfoCommand } from './bot/bot-info.command.js';
import { BotStatusCommand } from './bot/bot-status.command.js';
import { CommandLoggingInterceptor } from './interceptors/command-logging-interceptor.js';
import { PingCommand } from './ping.command.js';
import { RpgTableCreateCommand } from './rpg/table-create.command.js';
import { TableModule } from '../../rpg/table/table.module.js';

@Module({
  imports: [AdminModule, RpgModule, TableModule],
  providers: [
    PingCommand,
    BotInfoCommand,
    BotStatusCommand,
    CommandLoggingInterceptor,
    LogsCommand,
    RpgTableCreateCommand,
  ],
})
export class CommandsModule {}
