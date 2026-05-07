import { Module } from '@nestjs/common';

import { CommandLoggingInterceptor } from './interceptors/command-logging-interceptor.js';
import { PingCommand } from './ping.command.js';

@Module({
  providers: [PingCommand, CommandLoggingInterceptor],
})
export class CommandsModule {}
