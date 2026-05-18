import { Injectable, UseInterceptors } from '@nestjs/common';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  Button,
  ComponentParam,
  Context,
  Options,
  SlashCommand,
  StringOption,
  type ButtonContext,
  type SlashCommandContext,
} from 'necord';

import {
  LogsQueryService,
  type LogsQueryFilter,
  type LogsQueryResult,
  type LogsSearchItem,
} from '../../../admin/application/logs-query.service.js';
import type { LogKind, LogMetadata } from '../../../logger/domain/interfaces/log-entry.interface.js';
import type { SystemLogDocument } from '../../../logger/domain/schemas/system-log.schema.js';
import { CommandLoggingInterceptor } from '../interceptors/command-logging-interceptor.js';

export class LogsCommandOptions {
  @StringOption({
    name: 'search-item',
    description: 'Field used to filter logs',
    required: false,
    choices: [
      { name: 'kind', value: 'kind' },
      { name: 'guild-id', value: 'guild-id' },
      { name: 'actor-user-id', value: 'actor-user-id' },
    ],
  })
  readonly searchItem?: LogsSearchItem;

  @StringOption({
    name: 'param',
    description: 'Value searched in the selected field',
    required: false,
  })
  readonly param?: string;
}

type LogsPageDirection = 'previous' | 'next';

@Injectable()
export class LogsCommand {
  constructor(private readonly logsQueryService: LogsQueryService) {}

  @UseInterceptors(CommandLoggingInterceptor)
  @SlashCommand({ name: 'logs', description: 'Consult system logs' })
  async execute(@Context() [interaction]: SlashCommandContext, @Options() options: LogsCommandOptions): Promise<void> {
    const param = options.param?.trim();

    if (!this.hasValidFilterPair(options.searchItem, param)) {
      await interaction.reply({
        content: 'Use `/logs` or `/logs search-item:<kind|guild-id|actor-user-id> param:<value>`.',
        ephemeral: true,
      });
      return;
    }

    if (options.searchItem === 'kind' && param && !this.isLogKind(param)) {
      await interaction.reply({
        content: 'Invalid kind. Use `system` or `audit`.',
        ephemeral: true,
      });
      return;
    }

    const filter = {
      searchItem: options.searchItem,
      param,
    };
    await interaction.deferReply({ ephemeral: true });

    const result = await this.logsQueryService.findRecentLogs(filter);

    await interaction.editReply(this.buildLogsResponse(result, filter));
  }

  @Button('logs/:direction/:page/:searchItem/:param')
  async onPageButton(
    @Context() [interaction]: ButtonContext,
    @ComponentParam('direction') direction: LogsPageDirection,
    @ComponentParam('page') pageParam: string,
    @ComponentParam('searchItem') searchItemParam: string,
    @ComponentParam('param') encodedParam: string,
  ): Promise<void> {
    await interaction.deferUpdate();

    const page = Number.parseInt(pageParam, 10);
    const filter = this.createFilterFromCustomId(searchItemParam, encodedParam, page);
    const result = await this.logsQueryService.findRecentLogs(filter);

    await interaction.editReply(this.buildLogsResponse(result, filter));
  }

  private hasValidFilterPair(searchItem: LogsSearchItem | undefined, param: string | undefined): boolean {
    if (!searchItem && !param) {
      return true;
    }

    return Boolean(searchItem && param);
  }

  private isLogKind(value: string): value is LogKind {
    return value === 'system' || value === 'audit';
  }

  private buildLogsResponse(
    result: LogsQueryResult,
    filter: LogsQueryFilter,
  ): {
    readonly embeds: readonly EmbedBuilder[];
    readonly components: readonly ActionRowBuilder<ButtonBuilder>[];
  } {
    return {
      embeds: [this.buildLogsEmbed(result, filter.searchItem, filter.param)],
      components: [this.buildPaginationRow(result, filter)],
    };
  }

  private buildLogsEmbed(
    result: LogsQueryResult,
    searchItem: LogsSearchItem | undefined,
    param: string | undefined,
  ): EmbedBuilder {
    const title = searchItem && param ? `Recent logs by ${searchItem}: ${param}` : 'Recent logs';
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x3498db)
      .setFooter({ text: `Page ${result.page} of ${result.totalPages} | Total logs: ${result.total}` });

    if (!result.logs.length) {
      return embed.setDescription('No logs found.');
    }

    result.logs.forEach((log) => {
      embed.addFields({
        name: this.buildLogTitle(log),
        value: this.truncate(this.buildLogDescription(log), 1024),
      });
    });

    return embed;
  }

  private buildPaginationRow(result: LogsQueryResult, filter: LogsQueryFilter): ActionRowBuilder<ButtonBuilder> {
    const previousPage = Math.max(result.page - 1, 1);
    const nextPage = Math.min(result.page + 1, result.totalPages);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(this.buildPageCustomId('previous', previousPage, filter))
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(result.page <= 1),
      new ButtonBuilder()
        .setCustomId(this.buildPageCustomId('next', nextPage, filter))
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(result.page >= result.totalPages),
    );
  }

  private buildPageCustomId(direction: LogsPageDirection, page: number, filter: LogsQueryFilter): string {
    const searchItem = filter.searchItem ?? 'none';
    const param = filter.param ? encodeURIComponent(filter.param) : 'none';

    return `logs/${direction}/${page}/${searchItem}/${param}`;
  }

  private createFilterFromCustomId(searchItemParam: string, encodedParam: string, page: number): LogsQueryFilter {
    const searchItem = this.parseSearchItem(searchItemParam);
    const param = encodedParam === 'none' ? undefined : decodeURIComponent(encodedParam);

    return {
      searchItem,
      param,
      page,
    };
  }

  private parseSearchItem(value: string): LogsSearchItem | undefined {
    if (value === 'kind' || value === 'guild-id' || value === 'actor-user-id') {
      return value;
    }

    return undefined;
  }

  private buildLogTitle(log: SystemLogDocument): string {
    const timestamp = log.timestamp || 'No timestamp';
    const level = log.level.toUpperCase();
    const kind = log.kind ?? 'system';

    return this.truncate(`${timestamp} | ${level} | ${kind}`, 256);
  }

  private buildLogDescription(log: SystemLogDocument): string {
    const metadata = log.metadata;
    const guildId = this.getStringMetadata(metadata, 'guildId');
    const actorUserId = this.getStringMetadata(metadata, 'actorUserId');
    const lines = [`Message: ${log.message}`, `Context: ${log.context ?? 'Unavailable'}`];

    if (guildId) {
      lines.push(`Guild ID: ${guildId}`);
    }

    if (actorUserId) {
      lines.push(`Actor User ID: ${actorUserId}`);
    }

    return lines.join('\n');
  }

  private getStringMetadata(metadata: LogMetadata | undefined, key: string): string | null {
    const value = metadata?.[key];

    if (typeof value !== 'string') {
      return null;
    }

    return value;
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }
}
