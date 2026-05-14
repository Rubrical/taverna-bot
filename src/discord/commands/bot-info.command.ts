import { Injectable, UseInterceptors } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';
import { Context, SlashCommand, type SlashCommandContext } from 'necord';

import { BotStatusInfoService } from '../../admin/application/bot-status-info.service.js';
import type { BotInfo } from '../../admin/domain/bot-status-info.js';
import { formatElapsedTime } from '../../common/helpers/elapsed-time.helper.js';
import { CommandLoggingInterceptor } from './interceptors/command-logging-interceptor.js';

@Injectable()
export class BotInfoCommand {
  constructor(private readonly _botInfoService: BotStatusInfoService) {}

  @UseInterceptors(CommandLoggingInterceptor)
  @SlashCommand({ name: 'bot-info', description: 'Get the bot info' })
  async execute(@Context() [interaction]: SlashCommandContext): Promise<void> {
    const botStatus = await this._botInfoService.getCachedBotStatusOrElseBasicApplicationInfo();

    const botInfo: BotInfo = {
      name: botStatus.name,
      version: botStatus.version,
      latency: Date.now() - interaction.createdTimestamp,
      ownerId: botStatus.ownerId,
      ownerName: botStatus.ownerName,
      runningFor: formatElapsedTime(botStatus.startedAt),
    };

    await interaction.reply({
      embeds: [this.buildBotInfoEmbed(botInfo)],
    });
  }

  private buildBotInfoEmbed(botInfo: BotInfo): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`${botInfo.name} info`)
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Version', value: botInfo.version, inline: true },
        { name: 'Latency', value: `${botInfo.latency ?? 0} ms`, inline: true },
        { name: 'Running for', value: botInfo.runningFor ?? 'Unavailable', inline: true },
        { name: 'Owner', value: `${botInfo.ownerName} (${botInfo.ownerId})`, inline: false },
      );
  }
}
