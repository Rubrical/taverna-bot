import { Collection } from 'discord.js';
import type { ModalContext, SlashCommandContext, UserSelectContext } from 'necord';
import { randomUUID } from 'node:crypto';

import { RpgTableCreateCommand } from '../../../../src/discord/commands/rpg/table-create.command.js';
import { cacheKeys } from '../../../../src/infrastructure/cache/cache-keys.js';
import { Table } from '../../../../src/rpg/table/domain/entities/table.entity.js';
import { TableOperationFailedError } from '../../../../src/rpg/table/domain/errors/table-operation-failed-error.js';
import type { TableService } from '../../../../src/rpg/table/application/table.service.js';
import type { TavernaLogger } from '../../../../src/logger/infrastructure/taverna-logger.service.js';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}));

type TableServiceMock = {
  createTable: jest.Mock<ReturnType<TableService['createTable']>, Parameters<TableService['createTable']>>;
};

type TavernaLoggerMock = {
  setContext: jest.Mock<void, [string]>;
  error: jest.Mock<void, [string, Error, Record<string, unknown>]>;
};

type CacheMock = {
  get: jest.Mock<Promise<unknown>, [string]>;
  set: jest.Mock<Promise<void>, [string, unknown, number]>;
  del: jest.Mock<Promise<void>, [string]>;
};

type SlashInteractionMock = {
  showModal: jest.Mock<Promise<void>, [unknown]>;
};

type ModalInteractionMock = {
  guildId: string | null;
  user: { readonly id: string };
  fields: {
    getTextInputValue: jest.Mock<string, [string]>;
  };
  reply: jest.Mock<Promise<void>, [unknown]>;
};

type UserSelectInteractionMock = {
  users: Collection<string, { readonly id: string; readonly username: string }>;
  update: jest.Mock<Promise<void>, [unknown]>;
};

const mockedRandomUUID = randomUUID as jest.Mock<string, []>;

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

function createSlashContext(): {
  readonly context: SlashCommandContext;
  readonly interaction: SlashInteractionMock;
} {
  const interaction: SlashInteractionMock = {
    showModal: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as SlashCommandContext[0]],
    interaction,
  };
}

function createModalContext(values: {
  readonly name: string;
  readonly systemName: string;
  readonly guildId?: string | null;
  readonly userId?: string;
}): {
  readonly context: ModalContext;
  readonly interaction: ModalInteractionMock;
} {
  const interaction: ModalInteractionMock = {
    guildId: values.guildId === undefined ? 'guild-1' : values.guildId,
    user: { id: values.userId ?? 'master-1' },
    fields: {
      getTextInputValue: jest.fn<string, [string]>((customId) => {
        const fields: Record<string, string> = {
          [RpgTableCreateCommand.TABLE_NAME_INPUT_ID]: values.name,
          [RpgTableCreateCommand.SYSTEM_NAME_INPUT_ID]: values.systemName,
        };

        return fields[customId] ?? '';
      }),
    },
    reply: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as ModalContext[0]],
    interaction,
  };
}

function createUserSelectContext(users: Array<{ readonly id: string; readonly username: string }>): {
  readonly context: UserSelectContext;
  readonly interaction: UserSelectInteractionMock;
} {
  const interaction: UserSelectInteractionMock = {
    users: new Collection(users.map((user) => [user.id, user])),
    update: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as UserSelectContext[0]],
    interaction,
  };
}

describe('RpgTableCreateCommand', () => {
  let command: RpgTableCreateCommand;
  let tableService: TableServiceMock;
  let cache: CacheMock;
  let logger: TavernaLoggerMock;

  beforeEach(() => {
    mockedRandomUUID.mockReturnValue('draft-id');
    tableService = {
      createTable: jest.fn<ReturnType<TableService['createTable']>, Parameters<TableService['createTable']>>(),
    };
    cache = {
      get: jest.fn<Promise<unknown>, [string]>(),
      set: jest.fn<Promise<void>, [string, unknown, number]>().mockResolvedValue(undefined),
      del: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    };
    logger = {
      setContext: jest.fn<void, [string]>(),
      error: jest.fn<void, [string, Error, Record<string, unknown>]>(),
    };

    command = new RpgTableCreateCommand(
      tableService as unknown as TableService,
      cache as never,
      logger as unknown as TavernaLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets the logger context on construction', () => {
    expect(logger.setContext).toHaveBeenCalledWith(RpgTableCreateCommand.name);
  });

  it('shows the create table modal', async () => {
    const { context, interaction } = createSlashContext();

    await command.execute(context);

    expect(interaction.showModal).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(interaction.showModal.mock.calls[0]?.[0])).toContain(RpgTableCreateCommand.CREATE_MODAL_ID);
    expect(JSON.stringify(interaction.showModal.mock.calls[0]?.[0])).toContain(
      RpgTableCreateCommand.TABLE_NAME_INPUT_ID,
    );
    expect(JSON.stringify(interaction.showModal.mock.calls[0]?.[0])).toContain(
      RpgTableCreateCommand.SYSTEM_NAME_INPUT_ID,
    );
  });

  it('rejects invalid modal input', async () => {
    const { context, interaction } = createModalContext({ name: ' ', systemName: 'dnd5e' });

    await command.onCreateModal(context);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Table name is required.',
      ephemeral: true,
    });
  });

  it('rejects modal submit outside a guild', async () => {
    const { context, interaction } = createModalContext({ name: 'The Tavern', systemName: 'dnd5e', guildId: null });

    await command.onCreateModal(context);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used inside a Discord server.',
      ephemeral: true,
    });
  });

  it('sends a player select menu after valid modal input', async () => {
    const { context, interaction } = createModalContext({ name: 'The Tavern', systemName: 'dnd5e' });

    await command.onCreateModal(context);

    expect(cache.set).toHaveBeenCalledWith(
      cacheKeys.rpg.tableCreateDraft('draft-id'),
      {
        guildDiscordId: 'guild-1',
        masterDiscordId: 'master-1',
        name: 'The Tavern',
        systemName: 'dnd5e',
      },
      600000,
    );
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(interaction.reply.mock.calls[0]?.[0])).toContain('rpg/table/create/players/draft-id');
    expect(JSON.stringify(interaction.reply.mock.calls[0]?.[0])).toContain('min_values');
    expect(JSON.stringify(interaction.reply.mock.calls[0]?.[0])).toContain('max_values');
  });

  it('creates a table from selected players', async () => {
    tableService.createTable.mockResolvedValue(createTable());
    const modal = createModalContext({ name: 'The Tavern', systemName: 'dnd5e' });
    await command.onCreateModal(modal.context);
    cache.get.mockResolvedValue({
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      name: 'The Tavern',
      systemName: 'dnd5e',
    });
    const { context, interaction } = createUserSelectContext([
      { id: 'player-1', username: 'Player One' },
      { id: 'player-2', username: 'Player Two' },
    ]);

    await command.onPlayersSelected(context, 'draft-id');

    expect(tableService.createTable).toHaveBeenCalledWith({
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      name: 'The Tavern',
      systemName: 'dnd5e',
      players: [
        { playerDiscordId: 'player-1', playerName: 'Player One' },
        { playerDiscordId: 'player-2', playerName: 'Player Two' },
      ],
    });
    expect(cache.del).toHaveBeenCalledWith(cacheKeys.rpg.tableCreateDraft('draft-id'));
    expect(interaction.update).toHaveBeenCalledWith({
      content: 'Table "The Tavern" created successfully.',
      components: [],
    });
  });

  it('rejects player selections containing the master', async () => {
    const modal = createModalContext({ name: 'The Tavern', systemName: 'dnd5e' });
    await command.onCreateModal(modal.context);
    cache.get.mockResolvedValue({
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      name: 'The Tavern',
      systemName: 'dnd5e',
    });
    const { context, interaction } = createUserSelectContext([
      { id: 'master-1', username: 'Master' },
      { id: 'player-1', username: 'Player One' },
    ]);

    await command.onPlayersSelected(context, 'draft-id');

    expect(tableService.createTable).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledWith({
      content: 'The table master cannot be selected as a player.',
      components: [],
    });
  });

  it('rejects expired drafts', async () => {
    cache.get.mockResolvedValue(undefined);
    const { context, interaction } = createUserSelectContext([
      { id: 'player-1', username: 'Player One' },
      { id: 'player-2', username: 'Player Two' },
    ]);

    await command.onPlayersSelected(context, 'missing-draft-id');

    expect(tableService.createTable).not.toHaveBeenCalled();
    expect(interaction.update).toHaveBeenCalledWith({
      content: 'This table creation request expired. Run `/rpg table create` again.',
      components: [],
    });
  });

  it('handles table service failures', async () => {
    const error = new TableOperationFailedError('database unavailable');
    tableService.createTable.mockRejectedValue(error);
    const modal = createModalContext({ name: 'The Tavern', systemName: 'dnd5e' });
    await command.onCreateModal(modal.context);
    cache.get.mockResolvedValue({
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      name: 'The Tavern',
      systemName: 'dnd5e',
    });
    const { context, interaction } = createUserSelectContext([
      { id: 'player-1', username: 'Player One' },
      { id: 'player-2', username: 'Player Two' },
    ]);

    await command.onPlayersSelected(context, 'draft-id');

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to create RPG table from Discord command',
      error,
      expect.objectContaining({
        kind: 'audit',
        guildDiscordId: 'guild-1',
        masterDiscordId: 'master-1',
      }),
    );
    expect(interaction.update).toHaveBeenCalledWith({
      content: 'Could not create the table. Try again later.',
      components: [],
    });
  });
});
