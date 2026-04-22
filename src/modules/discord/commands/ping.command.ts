import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, type SlashCommandContext } from 'necord';

@Injectable()
export class PingCommand {
  @SlashCommand({
    name: 'ping',
    description: 'Replies with pong! Used to check if the bot is alive.',
  })
  async onPing(@Context() [interaction]: SlashCommandContext): Promise<void> {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply({
      content: `🏓 Pong! Latency: **${latency}ms**`,
    });
  }
}
