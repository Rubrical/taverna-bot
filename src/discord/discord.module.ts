import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NecordModule } from 'necord';
import { IntentsBitField } from 'discord.js';

import { CommandsModule } from './commands/commands.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    CommandsModule,
    EventsModule,
    NecordModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow<string>('DISCORD_TOKEN'),
        intents: [
          IntentsBitField.Flags.Guilds,
          IntentsBitField.Flags.GuildMessages,
          IntentsBitField.Flags.GuildMembers,
          IntentsBitField.Flags.GuildMessageReactions,
          IntentsBitField.Flags.GuildVoiceStates,
          IntentsBitField.Flags.MessageContent,
          IntentsBitField.Flags.DirectMessages,
          IntentsBitField.Flags.DirectMessageReactions,
        ],
        development: config.get<string>('DEV_GUILD_ID') ? [config.getOrThrow<string>('DEV_GUILD_ID')] : undefined,
      }),
    }),
    EventsModule,
  ],
  providers: [],
})
export class DiscordModule {}
