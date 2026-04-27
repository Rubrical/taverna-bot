import { Module } from '@nestjs/common';

import { PingCommand } from './ping.command.js';

@Module({
  providers: [PingCommand],
})
export class CommandsModule {}
