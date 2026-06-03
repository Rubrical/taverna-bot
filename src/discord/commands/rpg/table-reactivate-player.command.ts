import { Injectable } from '@nestjs/common';
import type { User } from 'discord.js';
import { Context, Options, StringOption, Subcommand, UserOption, type SlashCommandContext } from 'necord';

import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import { TableService } from '../../../rpg/table/application/table.service.js';
import { TableOperationFailedError } from '../../../rpg/table/domain/errors/table-operation-failed-error.js';
import { RpgCommand } from '../../commands-decorators/rpg-command.decorator.js';

export class RpgTableReactivatePlayerOptions {
  @StringOption({
    name: 'table-id',
    description: 'RPG table id',
    required: true,
  })
  readonly tableId: string;

  @UserOption({
    name: 'player',
    description: 'Discord user reactivated at the table',
    required: true,
  })
  readonly player: User;
}

@RpgCommand({ name: 'table', description: 'Manage RPG tables' })
@Injectable()
export class RpgTableReactivatePlayerCommand {
  constructor(
    private readonly _tableService: TableService,
    private readonly _logger: TavernaLogger,
  ) {
    this._logger.setContext(RpgTableReactivatePlayerCommand.name);
  }

  @Subcommand({ name: 'reactivate-player', description: 'Reactivate an absent RPG table player' })
  async execute(
    @Context() [interaction]: SlashCommandContext,
    @Options() options: RpgTableReactivatePlayerOptions,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used inside a Discord server.', ephemeral: true });
      return;
    }

    try {
      const table = await this._tableService.reactivatePlayer(options.tableId, options.player.id, interaction.user.id);

      await interaction.reply(`Player <@${options.player.id}> reactivated at table "${table.name ?? table.id}".`);
    } catch (error) {
      this._logger.error('Failed to reactivate RPG table player from Discord command', this.normalizeError(error), {
        kind: 'audit',
        guildDiscordId: interaction.guildId,
        tableId: options.tableId,
        playerDiscordId: options.player.id,
        requesterDiscordId: interaction.user.id,
      });

      await interaction.reply({
        content: 'Could not reactivate the player at the table. Try again later.',
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
