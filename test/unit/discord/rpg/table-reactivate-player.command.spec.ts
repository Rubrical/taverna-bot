import type { User } from 'discord.js';
import type { SlashCommandContext } from 'necord';

import {
  RpgTableReactivatePlayerCommand,
  type RpgTableReactivatePlayerOptions,
} from '../../../../src/discord/commands/rpg/table-reactivate-player.command.js';
import type { TavernaLogger } from '../../../../src/logger/infrastructure/taverna-logger.service.js';
import type { TableService } from '../../../../src/rpg/table/application/table.service.js';
import { Table } from '../../../../src/rpg/table/domain/entities/table.entity.js';
import { TableOperationFailedError } from '../../../../src/rpg/table/domain/errors/table-operation-failed-error.js';

type TableServiceMock = {
  reactivatePlayer: jest.Mock<ReturnType<TableService['reactivatePlayer']>, Parameters<TableService['reactivatePlayer']>>;
};

type TavernaLoggerMock = {
  setContext: jest.Mock<void, [string]>;
  error: jest.Mock<void, [string, Error, Record<string, unknown>]>;
};

type SlashInteractionMock = {
  guildId: string | null;
  user: { readonly id: string };
  reply: jest.Mock<Promise<void>, [unknown]>;
};

function createTable(): Table {
  return Table.restore({
    id: 'table-id',
    name: 'The Tavern',
    version: 1,
    systemName: 'dnd5e',
    guildDiscordId: 'guild-1',
    masterDiscordId: 'master-1',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    players: [],
  });
}

function createSlashContext(guildId: string | null = 'guild-1'): {
  readonly context: SlashCommandContext;
  readonly interaction: SlashInteractionMock;
} {
  const interaction: SlashInteractionMock = {
    guildId,
    user: { id: 'master-1' },
    reply: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as SlashCommandContext[0]],
    interaction,
  };
}

function createOptions(): RpgTableReactivatePlayerOptions {
  return {
    tableId: 'table-id',
    player: {
      id: 'discord-player-4',
      username: 'Player Four',
    } as User,
  };
}

describe('RpgTableReactivatePlayerCommand', () => {
  let command: RpgTableReactivatePlayerCommand;
  let tableService: TableServiceMock;
  let logger: TavernaLoggerMock;

  beforeEach(() => {
    tableService = {
      reactivatePlayer: jest.fn<
        ReturnType<TableService['reactivatePlayer']>,
        Parameters<TableService['reactivatePlayer']>
      >(),
    };
    logger = {
      setContext: jest.fn<void, [string]>(),
      error: jest.fn<void, [string, Error, Record<string, unknown>]>(),
    };

    command = new RpgTableReactivatePlayerCommand(
      tableService as unknown as TableService,
      logger as unknown as TavernaLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets the logger context on construction', () => {
    expect(logger.setContext).toHaveBeenCalledWith(RpgTableReactivatePlayerCommand.name);
  });

  it('rejects execution outside a guild', async () => {
    const { context, interaction } = createSlashContext(null);

    await command.execute(context, createOptions());

    expect(tableService.reactivatePlayer).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used inside a Discord server.',
      ephemeral: true,
    });
  });

  it('reactivates a player at the selected table', async () => {
    tableService.reactivatePlayer.mockResolvedValue(createTable());
    const { context, interaction } = createSlashContext();

    await command.execute(context, createOptions());

    expect(tableService.reactivatePlayer).toHaveBeenCalledWith('table-id', 'discord-player-4', 'master-1');
    expect(interaction.reply).toHaveBeenCalledWith('Player <@discord-player-4> reactivated at table "The Tavern".');
  });

  it('handles table service failures', async () => {
    const error = new TableOperationFailedError('database unavailable');
    tableService.reactivatePlayer.mockRejectedValue(error);
    const { context, interaction } = createSlashContext();

    await command.execute(context, createOptions());

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to reactivate RPG table player from Discord command',
      error,
      {
        kind: 'audit',
        guildDiscordId: 'guild-1',
        tableId: 'table-id',
        playerDiscordId: 'discord-player-4',
        requesterDiscordId: 'master-1',
      },
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Could not reactivate the player at the table. Try again later.',
      ephemeral: true,
    });
  });
});
