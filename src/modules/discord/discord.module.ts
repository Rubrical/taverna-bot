import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NecordModule } from 'necord';
import { IntentsBitField } from 'discord.js';

import { PingCommand } from './commands/ping.command.js';

@Module({
  imports: [
    NecordModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow<string>('DISCORD_TOKEN'),
        intents: [IntentsBitField.Flags.Guilds],
        development: config.get<string>('DEV_GUILD_ID') ? [config.getOrThrow<string>('DEV_GUILD_ID')] : undefined,
      }),
    }),
  ],
  providers: [PingCommand],
})
export class DiscordModule {}
