import type { User } from 'discord.js';
import type { SlashCommandContext } from 'necord';

import {
  RpgTableAddPlayerCommand,
  type RpgTableAddPlayerOptions,
} from '../../../../src/discord/commands/rpg/table-add-player.command.js';
import type { TavernaLogger } from '../../../../src/logger/infrastructure/taverna-logger.service.js';
import type { TableService } from '../../../../src/rpg/table/application/table.service.js';
import { Table } from '../../../../src/rpg/table/domain/entities/table.entity.js';
import { TableOperationFailedError } from '../../../../src/rpg/table/domain/errors/table-operation-failed-error.js';

type TableServiceMock = {
  addPlayer: jest.Mock<ReturnType<TableService['addPlayer']>, Parameters<TableService['addPlayer']>>;
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

function createOptions(): RpgTableAddPlayerOptions {
  return {
    tableId: 'table-id',
    player: {
      id: 'discord-player-4',
      username: 'Player Four',
    } as User,
  };
}

describe('RpgTableAddPlayerCommand', () => {
  let command: RpgTableAddPlayerCommand;
  let tableService: TableServiceMock;
  let logger: TavernaLoggerMock;

  beforeEach(() => {
    tableService = {
      addPlayer: jest.fn<ReturnType<TableService['addPlayer']>, Parameters<TableService['addPlayer']>>(),
    };
    logger = {
      setContext: jest.fn<void, [string]>(),
      error: jest.fn<void, [string, Error, Record<string, unknown>]>(),
    };

    command = new RpgTableAddPlayerCommand(
      tableService as unknown as TableService,
      logger as unknown as TavernaLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets the logger context on construction', () => {
    expect(logger.setContext).toHaveBeenCalledWith(RpgTableAddPlayerCommand.name);
  });

  it('rejects execution outside a guild', async () => {
    const { context, interaction } = createSlashContext(null);

    await command.execute(context, createOptions());

    expect(tableService.addPlayer).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used inside a Discord server.',
      ephemeral: true,
    });
  });

  it('adds a player to the selected table', async () => {
    tableService.addPlayer.mockResolvedValue(createTable());
    const { context, interaction } = createSlashContext();

    await command.execute(context, createOptions());

    expect(tableService.addPlayer).toHaveBeenCalledWith(
      'table-id',
      'Player Four',
      'discord-player-4',
      'master-1',
    );
    expect(interaction.reply).toHaveBeenCalledWith('Player <@discord-player-4> added to table "The Tavern".');
  });

  it('handles table service failures', async () => {
    const error = new TableOperationFailedError('database unavailable');
    tableService.addPlayer.mockRejectedValue(error);
    const { context, interaction } = createSlashContext();

    await command.execute(context, createOptions());

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to add RPG table player from Discord command',
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
      content: 'Could not add the player to the table. Try again later.',
      ephemeral: true,
    });
  });
});
