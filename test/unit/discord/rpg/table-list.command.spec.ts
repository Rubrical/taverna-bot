import type { SlashCommandContext } from 'necord';

import { RpgTableListCommand } from '../../../../src/discord/commands/rpg/table-list.command.js';
import type { TavernaLogger } from '../../../../src/logger/infrastructure/taverna-logger.service.js';
import type { TableService } from '../../../../src/rpg/table/application/table.service.js';
import { Table } from '../../../../src/rpg/table/domain/entities/table.entity.js';
import { TablePlayer } from '../../../../src/rpg/table/domain/entities/table-player.entity.js';
import { TableOperationFailedError } from '../../../../src/rpg/table/domain/errors/table-operation-failed-error.js';

type TableServiceMock = {
  findTables: jest.Mock<ReturnType<TableService['findTables']>, Parameters<TableService['findTables']>>;
};

type TavernaLoggerMock = {
  setContext: jest.Mock<void, [string]>;
  error: jest.Mock<void, [string, Error, Record<string, unknown>]>;
};

type SlashInteractionMock = {
  guildId: string | null;
  reply: jest.Mock<Promise<void>, [unknown]>;
};

function createTable(overrides: {
  readonly id?: string;
  readonly name?: string;
  readonly systemName?: string;
  readonly masterDiscordId?: string;
  readonly players?: readonly TablePlayer[];
} = {}): Table {
  return Table.restore({
    id: overrides.id ?? 'table-id',
    name: overrides.name ?? 'The Tavern',
    version: 1,
    systemName: overrides.systemName ?? 'dnd5e',
    guildDiscordId: 'guild-1',
    masterDiscordId: overrides.masterDiscordId ?? 'master-1',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    players: [...(overrides.players ?? [])],
  });
}

function createPlayer(id: string, username: string, status: 'active' | 'absent' | 'banned' = 'active'): TablePlayer {
  return TablePlayer.restore({
    id,
    username,
    userDiscordId: id,
    version: 1,
    status,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function createSlashContext(guildId: string | null = 'guild-1'): {
  readonly context: SlashCommandContext;
  readonly interaction: SlashInteractionMock;
} {
  const interaction: SlashInteractionMock = {
    guildId,
    reply: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as SlashCommandContext[0]],
    interaction,
  };
}

describe('RpgTableListCommand', () => {
  let command: RpgTableListCommand;
  let tableService: TableServiceMock;
  let logger: TavernaLoggerMock;

  beforeEach(() => {
    tableService = {
      findTables: jest.fn<ReturnType<TableService['findTables']>, Parameters<TableService['findTables']>>(),
    };
    logger = {
      setContext: jest.fn<void, [string]>(),
      error: jest.fn<void, [string, Error, Record<string, unknown>]>(),
    };

    command = new RpgTableListCommand(
      tableService as unknown as TableService,
      logger as unknown as TavernaLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets the logger context on construction', () => {
    expect(logger.setContext).toHaveBeenCalledWith(RpgTableListCommand.name);
  });

  it('rejects execution outside a guild', async () => {
    const { context, interaction } = createSlashContext(null);

    await command.execute(context);

    expect(tableService.findTables).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used inside a Discord server.',
      ephemeral: true,
    });
  });

  it('lists active tables from the current guild', async () => {
    tableService.findTables.mockResolvedValue([
      createTable({
        players: [
          createPlayer('player-1', 'Player One'),
          createPlayer('player-2', 'Player Two'),
          createPlayer('player-3', 'Player Three', 'absent'),
        ],
      }),
    ]);
    const { context, interaction } = createSlashContext();

    await command.execute(context);

    expect(tableService.findTables).toHaveBeenCalledWith({
      guildDiscordId: 'guild-1',
      status: 'active',
      limit: RpgTableListCommand.MAX_TABLES,
    });
    expect(interaction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)],
      ephemeral: true,
    });
    const embedJson = JSON.stringify((interaction.reply.mock.calls[0]?.[0] as { embeds: readonly unknown[] }).embeds[0]);
    expect(embedJson).toContain('Active RPG tables');
    expect(embedJson).toContain('The Tavern');
    expect(embedJson).toContain('System: dnd5e');
    expect(embedJson).toContain('Master: <@master-1>');
    expect(embedJson).toContain('Players: 2');
    expect(embedJson).toContain('Status: active');
  });

  it('responds with an empty embed when no active tables exist', async () => {
    tableService.findTables.mockResolvedValue([]);
    const { context, interaction } = createSlashContext();

    await command.execute(context);

    const embedJson = JSON.stringify((interaction.reply.mock.calls[0]?.[0] as { embeds: readonly unknown[] }).embeds[0]);
    expect(embedJson).toContain('Active RPG tables');
    expect(embedJson).toContain('No active RPG tables found.');
  });

  it('handles table service failures', async () => {
    const error = new TableOperationFailedError('database unavailable');
    tableService.findTables.mockRejectedValue(error);
    const { context, interaction } = createSlashContext();

    await command.execute(context);

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to list RPG tables from Discord command',
      error,
      expect.objectContaining({
        kind: 'audit',
        guildDiscordId: 'guild-1',
      }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Could not list RPG tables. Try again later.',
      ephemeral: true,
    });
  });
});
