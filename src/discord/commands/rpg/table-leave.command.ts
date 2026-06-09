import { Injectable } from '@nestjs/common';
import { Context, Options, StringOption, Subcommand, type SlashCommandContext } from 'necord';

import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import { TableService } from '../../../rpg/table/application/table.service.js';
import { TableOperationFailedError } from '../../../rpg/table/domain/errors/table-operation-failed-error.js';
import { RpgCommand } from '../../commands-decorators/rpg-command.decorator.js';

export class RpgTableLeaveOptions {
  @StringOption({
    name: 'table-id',
    description: 'RPG table id',
    required: true,
  })
  readonly tableId: string;
}

@RpgCommand({ name: 'table', description: 'Manage RPG tables' })
@Injectable()
export class RpgTableLeaveCommand {
  constructor(
    private readonly _tableService: TableService,
    private readonly _logger: TavernaLogger,
  ) {
    this._logger.setContext(RpgTableLeaveCommand.name);
  }

  @Subcommand({ name: 'leave', description: 'Leave an RPG table' })
  async execute(
    @Context() [interaction]: SlashCommandContext,
    @Options() options: RpgTableLeaveOptions,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used inside a Discord server.', ephemeral: true });
      return;
    }

    try {
      const table = await this._tableService.playerLeave(options.tableId, interaction.user.id);

      await interaction.reply(`Player <@${interaction.user.id}> left table "${table.name ?? table.id}".`);
    } catch (error) {
      this._logger.error('Failed to leave RPG table from Discord command', this.normalizeError(error), {
        kind: 'audit',
        guildDiscordId: interaction.guildId,
        tableId: options.tableId,
        playerDiscordId: interaction.user.id,
      });

      await interaction.reply({
        content: 'Could not leave the table. Try again later.',
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
