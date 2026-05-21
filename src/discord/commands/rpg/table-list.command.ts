import { Injectable } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';
import { Context, Subcommand, type SlashCommandContext } from 'necord';

import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import { TableService } from '../../../rpg/table/application/table.service.js';
import type { Table } from '../../../rpg/table/domain/entities/table.entity.js';
import { TableOperationFailedError } from '../../../rpg/table/domain/errors/table-operation-failed-error.js';
import { RpgCommand } from '../../commands-decorators/rpg-command.decorator.js';

@RpgCommand({ name: 'table', description: 'Manage RPG tables' })
@Injectable()
export class RpgTableListCommand {
  static readonly MAX_TABLES = 10;

  constructor(
    private readonly _tableService: TableService,
    private readonly _logger: TavernaLogger,
  ) {
    this._logger.setContext(RpgTableListCommand.name);
  }

  @Subcommand({ name: 'list', description: 'List active RPG tables' })
  async execute(@Context() [interaction]: SlashCommandContext): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used inside a Discord server.', ephemeral: true });
      return;
    }

    try {
      const tables = await this._tableService.findTables({
        guildDiscordId: interaction.guildId,
        status: 'active',
        limit: RpgTableListCommand.MAX_TABLES,
      });

      await interaction.reply({
        embeds: [this.buildTablesEmbed(tables)],
        ephemeral: true,
      });
    } catch (error) {
      this._logger.error('Failed to list RPG tables from Discord command', this.normalizeError(error), {
        kind: 'audit',
        guildDiscordId: interaction.guildId,
      });

      await interaction.reply({ content: 'Could not list RPG tables. Try again later.', ephemeral: true });
    }
  }

  private buildTablesEmbed(tables: readonly Table[]): EmbedBuilder {
    const embed = new EmbedBuilder().setTitle('Active RPG tables').setColor(0x3498db);

    if (!tables.length) {
      return embed.setDescription('No active RPG tables found.');
    }

    tables.slice(0, RpgTableListCommand.MAX_TABLES).forEach((table) => {
      embed.addFields({
        name: this.truncate(table.name ?? `Table ${table.id}`, 256),
        value: this.truncate(this.buildTableDescription(table), 1024),
      });
    });

    return embed;
  }

  private buildTableDescription(table: Table): string {
    const activePlayers = table.players.filter((player) => player.status === 'active').length;

    return [
      `System: ${table.systemName}`,
      `Master: <@${table.masterDiscordId}>`,
      `Players: ${activePlayers}`,
      `Status: ${table.status}`,
    ].join('\n');
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new TableOperationFailedError(String(error));
  }
}
