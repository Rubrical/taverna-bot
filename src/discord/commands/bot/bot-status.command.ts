import { Injectable, UseInterceptors } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';
import { Context, SlashCommand, type SlashCommandContext } from 'necord';

import { BotStatusInfoService } from '../../../admin/application/bot-status-info.service.js';
import type { BotStatus } from '../../../admin/domain/bot-status-info.js';
import { dateFormatHelperYearMonthDay } from '../../../common/helpers/date-format.helper.js';
import { formatElapsedTime } from '../../../common/helpers/elapsed-time.helper.js';
import { getStatusColor } from '../../../common/helpers/status-color.helper.js';
import { CommandLoggingInterceptor } from '../interceptors/command-logging-interceptor.js';

@Injectable()
export class BotStatusCommand {
  constructor(private readonly _botInfoService: BotStatusInfoService) {}

  @UseInterceptors(CommandLoggingInterceptor)
  @SlashCommand({ name: 'bot-status', description: 'Get the complete bot status' })
  async execute(@Context() [interaction]: SlashCommandContext): Promise<void> {
    const botStatus = await this._botInfoService.getCachedBotStatusOrElseBasicApplicationInfo();

    await interaction.reply({
      embeds: [this.buildBotStatusEmbed(botStatus)],
    });
  }

  private buildBotStatusEmbed(botStatus: BotStatus): EmbedBuilder {
    const discordStatus = botStatus.discordBotStatus;
    const startedAt = dateFormatHelperYearMonthDay(botStatus.startedAt);
    const runningFor = formatElapsedTime(botStatus.startedAt);
    const readyAt = dateFormatHelperYearMonthDay(discordStatus?.clientReadyAt);
    const guilds = discordStatus?.guilds.length ? discordStatus.guilds.join(', ') : 'No guilds available';

    return new EmbedBuilder()
      .setTitle(`${botStatus.name} status`)
      .setColor(getStatusColor(botStatus.status))
      .addFields(
        { name: 'Status', value: botStatus.status, inline: true },
        { name: 'Version', value: botStatus.version, inline: true },
        { name: 'Node.js', value: botStatus.nodeVersion, inline: true },
        { name: 'Started at', value: startedAt, inline: false },
        { name: 'Running for', value: runningFor, inline: false },
        { name: 'Memory RSS', value: `${botStatus.memoryUsage} MB`, inline: true },
        { name: 'Heap used', value: `${botStatus.memoryHeapUsage} MB`, inline: true },
        { name: 'PID', value: botStatus.pid.toString(), inline: true },
        { name: 'Owner', value: `${botStatus.ownerName} (${botStatus.ownerId})`, inline: false },
        { name: 'Commit', value: botStatus.lastCommitHash ?? 'Unavailable', inline: true },
        { name: 'Discord status', value: discordStatus?.clientStatus ?? 'Unavailable', inline: true },
        { name: 'Discord ready at', value: readyAt, inline: true },
        {
          name: 'Discord bot',
          value: discordStatus ? `${discordStatus.discordName} (${discordStatus.discordId})` : 'Unavailable',
        },
        { name: 'Guilds', value: guilds },
      );
  }
}
