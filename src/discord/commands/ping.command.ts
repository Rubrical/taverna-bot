import { Injectable, UseInterceptors } from '@nestjs/common';
import { Context, SlashCommand, type SlashCommandContext } from 'necord';

import { CommandLoggingInterceptor } from './interceptors/command-logging-interceptor.js';

@Injectable()
export class PingCommand {
  constructor() {}

  @SlashCommand({
    name: 'ping',
    description: 'Replies with pong! Used to check if the bot is alive.',
    guilds: [process.env.DEV_GUILD_ID!],
  })
  @UseInterceptors(CommandLoggingInterceptor)
  async onPing(@Context() [interaction]: SlashCommandContext): Promise<void> {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply({
      content: `🏓 Pong! Latency: **${latency}ms**`,
    });
  }
}
