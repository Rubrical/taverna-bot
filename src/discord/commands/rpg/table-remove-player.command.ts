import { Injectable } from '@nestjs/common';
import type { User } from 'discord.js';
import { Context, Options, StringOption, Subcommand, UserOption, type SlashCommandContext } from 'necord';

import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import { TableService } from '../../../rpg/table/application/table.service.js';
import { TableOperationFailedError } from '../../../rpg/table/domain/errors/table-operation-failed-error.js';
import { RpgCommand } from '../../commands-decorators/rpg-command.decorator.js';

export class RpgTableRemovePlayerOptions {
  @StringOption({
    name: 'table-id',
    description: 'RPG table id',
    required: true,
  })
  readonly tableId: string;

  @UserOption({
    name: 'player',
    description: 'Discord user removed from the table',
    required: true,
  })
  readonly player: User;
}

@RpgCommand({ name: 'table', description: 'Manage RPG tables' })
@Injectable()
export class RpgTableRemovePlayerCommand {
  constructor(
    private readonly _tableService: TableService,
    private readonly _logger: TavernaLogger,
  ) {
    this._logger.setContext(RpgTableRemovePlayerCommand.name);
  }

  @Subcommand({ name: 'remove-player', description: 'Remove a player from an RPG table' })
  async execute(
    @Context() [interaction]: SlashCommandContext,
    @Options() options: RpgTableRemovePlayerOptions,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used inside a Discord server.', ephemeral: true });
      return;
    }

    try {
      const table = await this._tableService.banPlayer(options.tableId, options.player.id, interaction.user.id);

      await interaction.reply(`Player <@${options.player.id}> removed from table "${table.name ?? table.id}".`);
    } catch (error) {
      this._logger.error('Failed to remove RPG table player from Discord command', this.normalizeError(error), {
        kind: 'audit',
        guildDiscordId: interaction.guildId,
        tableId: options.tableId,
        playerDiscordId: options.player.id,
        requesterDiscordId: interaction.user.id,
      });

      await interaction.reply({
        content: 'Could not remove the player from the table. Try again later.',
        ephemeral: true,
      });
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new TableOperationFailedError(String(error));
  }
}
