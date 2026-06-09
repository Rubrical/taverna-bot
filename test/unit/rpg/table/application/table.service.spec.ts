import { Test, type TestingModule } from '@nestjs/testing';

import { MongoTransactionProvider } from '../../../../../src/infrastructure/database/mongo-transaction-provider.js';
import { TavernaLogger } from '../../../../../src/logger/infrastructure/taverna-logger.service.js';
import { TableService } from '../../../../../src/rpg/table/application/table.service.js';
import { Table } from '../../../../../src/rpg/table/domain/entities/table.entity.js';
import { TablePlayer } from '../../../../../src/rpg/table/domain/entities/table-player.entity.js';
import { TableNotFoundError } from '../../../../../src/rpg/table/domain/errors/table-not-found-error.js';
import {
  TableRepository,
  type TableSearchCriteria,
} from '../../../../../src/rpg/table/infrastructure/repositories/table.repository.js';

type TableRepositoryMock = {
  save: jest.Mock<Promise<Table>, [Table]>;
  findById: jest.Mock<Promise<Table | null>, [string]>;
  findMany: jest.Mock<Promise<readonly Table[]>, [TableSearchCriteria]>;
};

type TransactionProviderMock = {
  run: jest.Mock<Promise<unknown>, [() => Promise<unknown>]>;
};

type TavernaLoggerMock = {
  setContext: jest.Mock<void, [string]>;
  log: jest.Mock<void, [string, Record<string, unknown>?]>;
  warn: jest.Mock<void, [string, Record<string, unknown>?]>;
  error: jest.Mock<void, [string, Error, Record<string, unknown>]>;
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
    players: [
      TablePlayer.restore({
        id: 'player-id-1',
        username: 'Player One',
        userDiscordId: 'discord-player-1',
        status: 'active',
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      TablePlayer.restore({
        id: 'player-id-2',
        username: 'Player Two',
        userDiscordId: 'discord-player-2',
        status: 'active',
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      TablePlayer.restore({
        id: 'player-id-3',
        username: 'Player Three',
        userDiscordId: 'discord-player-3',
        status: 'active',
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ],
  });
}

describe('TableService', () => {
  let service: TableService;
  let repository: TableRepositoryMock;
  let transactionProvider: TransactionProviderMock;
  let logger: TavernaLoggerMock;

  beforeEach(async () => {
    repository = {
      save: jest.fn<Promise<Table>, [Table]>(),
      findById: jest.fn<Promise<Table | null>, [string]>(),
      findMany: jest.fn<Promise<readonly Table[]>, [TableSearchCriteria]>(),
    };
    transactionProvider = {
      run: jest.fn<Promise<unknown>, [() => Promise<unknown>]>((work) => work()),
    };
    logger = {
      setContext: jest.fn<void, [string]>(),
      log: jest.fn<void, [string, Record<string, unknown>?]>(),
      warn: jest.fn<void, [string, Record<string, unknown>?]>(),
      error: jest.fn<void, [string, Error, Record<string, unknown>]>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableService,
        {
          provide: TableRepository,
          useValue: repository,
        },
        {
          provide: MongoTransactionProvider,
          useValue: transactionProvider,
        },
        {
          provide: TavernaLogger,
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<TableService>(TableService);
  });

  it('sets the logger context on construction', () => {
    expect(logger.setContext).toHaveBeenCalledWith(TableService.name);
  });

  it('creates a table inside a transaction', async () => {
    repository.save.mockImplementation((table) =>
      Promise.resolve(
        Table.restore({
          id: 'table-id',
          name: table.name,
          version: table.version,
          systemName: table.systemName,
          guildDiscordId: table.guildDiscordId,
          masterDiscordId: table.masterDiscordId,
          players: table.players,
          status: table.status,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
        }),
      ),
    );

    const result = await service.createTable({
      guildDiscordId: 'guild-1',
      systemName: 'dnd5e',
      masterDiscordId: 'master-1',
      name: 'The Tavern',
      players: [
        { playerDiscordId: 'discord-player-1', playerName: 'Player One' },
        { playerDiscordId: 'discord-player-2', playerName: 'Player Two' },
      ],
    });

    expect(transactionProvider.run).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(expect.any(Table));
    expect(result.id).toBe('table-id');
    expect(logger.log).toHaveBeenCalledWith('Table created', {
      tableId: 'table-id',
      guildDiscordId: 'guild-1',
      kind: 'audit',
    });
  });

  it('finds a table by id', async () => {
    const table = createTable();
    repository.findById.mockResolvedValue(table);

    const result = await service.findTableById('table-id');

    expect(repository.findById).toHaveBeenCalledWith('table-id');
    expect(result).toBe(table);
  });

  it('finds tables by criteria', async () => {
    const table = createTable();
    const criteria = { guildDiscordId: 'guild-1', status: 'active' as const };
    repository.findMany.mockResolvedValue([table]);

    const result = await service.findTables(criteria);

    expect(repository.findMany).toHaveBeenCalledWith(criteria);
    expect(result).toEqual([table]);
  });

  it('adds a player to an existing table', async () => {
    const table = createTable();
    repository.findById.mockResolvedValue(table);
    repository.save.mockImplementation((savedTable) => Promise.resolve(savedTable));

    const result = await service.addPlayer('table-id', 'Player Four', 'discord-player-4', 'master-1');

    expect(repository.findById).toHaveBeenCalledWith('table-id');
    expect(repository.save).toHaveBeenCalledWith(table);
    expect(result.players).toHaveLength(4);
    expect(result.players.at(-1)?.userDiscordId).toBe('discord-player-4');
    expect(logger.log).toHaveBeenCalledWith('Player added to table', {
      tableId: 'table-id',
      playerDiscordId: 'discord-player-4',
      requesterDiscordId: 'master-1',
      kind: 'audit',
    });
  });

  it('removes a player on an existing table', async () => {
    const table = createTable();
    repository.findById.mockResolvedValue(table);
    repository.save.mockImplementation((savedTable) => Promise.resolve(savedTable));

    const result = await service.removePlayer('table-id', 'discord-player-3', 'master-1');

    expect(repository.save).toHaveBeenCalledWith(table);
    expect(result.players[2].status).toBe('absent');
    expect(logger.log).toHaveBeenCalledWith('Player removed from table', {
      tableId: 'table-id',
      playerDiscordId: 'discord-player-3',
      requesterDiscordId: 'master-1',
      kind: 'audit',
    });
  });

  it('lets a player leave an existing table', async () => {
    const table = createTable();
    repository.findById.mockResolvedValue(table);
    repository.save.mockImplementation((savedTable) => Promise.resolve(savedTable));

    const result = await service.playerLeave('table-id', 'discord-player-1');

    expect(repository.findById).toHaveBeenCalledWith('table-id');
    expect(repository.save).toHaveBeenCalledWith(table);
    expect(result.players[0].status).toBe('absent');
    expect(logger.log).toHaveBeenCalledWith('Player left table', {
      tableId: 'table-id',
      playerDiscordId: 'discord-player-1',
      kind: 'audit',
    });
  });

  it('reactivates an absent player on an existing table', async () => {
    const table = createTable();
    table.removePlayer('discord-player-3', 'master-1');
    repository.findById.mockResolvedValue(table);
    repository.save.mockImplementation((savedTable) => Promise.resolve(savedTable));

    const result = await service.reactivatePlayer('table-id', 'discord-player-3', 'master-1');

    expect(repository.save).toHaveBeenCalledWith(table);
    expect(result.players[2].status).toBe('active');
    expect(logger.log).toHaveBeenCalledWith('Player reactivated at table', {
      tableId: 'table-id',
      playerDiscordId: 'discord-player-3',
      requesterDiscordId: 'master-1',
      kind: 'audit',
    });
  });

  it('bans a player on an existing table', async () => {
    const table = createTable();
    repository.findById.mockResolvedValue(table);
    repository.save.mockImplementation((savedTable) => Promise.resolve(savedTable));

    const result = await service.banPlayer('table-id', 'discord-player-3', 'master-1');

    expect(repository.save).toHaveBeenCalledWith(table);
    expect(result.players[2].status).toBe('banned');
    expect(logger.log).toHaveBeenCalledWith('Player banned at table', {
      tableId: 'table-id',
      playerDiscordId: 'discord-player-3',
      requesterDiscordId: 'master-1',
      kind: 'audit',
    });
  });

  it('archives an existing table', async () => {
    const table = createTable();
    repository.findById.mockResolvedValue(table);
    repository.save.mockImplementation((savedTable) => Promise.resolve(savedTable));

    const result = await service.archiveTable('table-id');

    expect(result.status).toBe('archived');
    expect(result.archivedAt).toBeInstanceOf(Date);
    expect(logger.log).toHaveBeenCalledWith('Table archived', { tableId: 'table-id', kind: 'audit' });
  });

  it('unarchives an existing table', async () => {
    const table = createTable();
    table.archive();
    repository.findById.mockResolvedValue(table);
    repository.save.mockImplementation((savedTable) => Promise.resolve(savedTable));

    const result = await service.unarchiveTable('table-id');

    expect(result.status).toBe('active');
    expect(result.archivedAt).toBeUndefined();
    expect(logger.log).toHaveBeenCalledWith('Table unarchived', { tableId: 'table-id', kind: 'audit' });
  });

  it('throws a domain error when a mutation targets a missing table', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.archiveTable('missing-table-id')).rejects.toBeInstanceOf(TableNotFoundError);

    expect(repository.save).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Table not found', { tableId: 'missing-table-id', kind: 'audit' });
    expect(logger.error).toHaveBeenCalledWith('Table operation failed', expect.any(TableNotFoundError), {
      kind: 'audit',
      operation: 'archive-table',
    });
  });
});
