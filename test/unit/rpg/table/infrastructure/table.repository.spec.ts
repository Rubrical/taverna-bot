import type { Model } from 'mongoose';

import { Table } from '../../../../../src/rpg/table/domain/entities/table.entity.js';
import { TablePlayer } from '../../../../../src/rpg/table/domain/entities/table-player.entity.js';
import type { TableDocument } from '../../../../../src/rpg/table/domain/schemas/table.schema.js';
import { TableRepository } from '../../../../../src/rpg/table/infrastructure/repositories/table.repository.js';

type QueryMock<TResult> = {
  limit: jest.Mock<QueryMock<TResult>, [number]>;
  skip: jest.Mock<QueryMock<TResult>, [number]>;
  exec: jest.Mock<Promise<TResult>, []>;
};

type TableModelMock = jest.Mock & {
  findById: jest.Mock<QueryMock<TableDocument | null>, [string]>;
  find: jest.Mock<QueryMock<TableDocument[]>, [Record<string, unknown>]>;
};

function createQueryMock<TResult>(result: TResult): QueryMock<TResult> {
  const query = {
    limit: jest.fn<QueryMock<TResult>, [number]>(),
    skip: jest.fn<QueryMock<TResult>, [number]>(),
    exec: jest.fn<Promise<TResult>, []>().mockResolvedValue(result),
  };

  query.limit.mockReturnValue(query);
  query.skip.mockReturnValue(query);

  return query;
}

function createTableDocument(): TableDocument {
  return {
    _id: 'table-id',
    name: 'The Tavern',
    version: 2,
    systemName: 'dnd5e',
    guildDiscordId: 'guild-1',
    masterDiscordId: 'master-1',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    players: [
      {
        _id: 'player-id',
        username: 'Player One',
        userDiscordId: 'discord-player-1',
        status: 'active',
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  } as unknown as TableDocument;
}

function createTableModelMock(saveResult: TableDocument): {
  readonly model: TableModelMock;
  readonly save: jest.Mock<Promise<TableDocument>, []>;
} {
  const save = jest.fn<Promise<TableDocument>, []>().mockResolvedValue(saveResult);
  const model = jest.fn().mockImplementation((entry: Record<string, unknown>) => ({
    ...entry,
    save,
  })) as TableModelMock;

  model.findById = jest.fn<QueryMock<TableDocument | null>, [string]>();
  model.find = jest.fn<QueryMock<TableDocument[]>, [Record<string, unknown>]>();

  return { model, save };
}

describe('TableRepository', () => {
  let document: TableDocument;
  let model: TableModelMock;
  let save: jest.Mock<Promise<TableDocument>, []>;
  let repository: TableRepository;

  beforeEach(() => {
    document = createTableDocument();

    const modelMock = createTableModelMock(document);
    model = modelMock.model;
    save = modelMock.save;
    repository = new TableRepository(model as unknown as Model<TableDocument>);
  });

  it('saves a table and returns the restored domain entity', async () => {
    const table = Table.restore({
      id: 'table-id',
      name: 'The Tavern',
      version: 2,
      systemName: 'dnd5e',
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      players: [
        TablePlayer.restore({
          id: 'player-id',
          username: 'Player One',
          userDiscordId: 'discord-player-1',
          status: 'active',
          version: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ],
    });

    const result = await repository.save(table);

    expect(model).toHaveBeenCalledWith({
      _id: 'table-id',
      name: 'The Tavern',
      version: 2,
      systemName: 'dnd5e',
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      archivedAt: undefined,
      players: [
        {
          _id: 'player-id',
          username: 'Player One',
          userDiscordId: 'discord-player-1',
          status: 'active',
          version: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Table);
    expect(result.id).toBe('table-id');
    expect(result.players[0]).toBeInstanceOf(TablePlayer);
    expect(result.players[0].id).toBe('player-id');
  });

  it('finds a table by id', async () => {
    model.findById.mockReturnValueOnce(createQueryMock(document));

    const result = await repository.findById('table-id');

    expect(model.findById).toHaveBeenCalledWith('table-id');
    expect(result).toBeInstanceOf(Table);
    expect(result?.id).toBe('table-id');
    expect(result?.players[0].userDiscordId).toBe('discord-player-1');
  });

  it('returns null when table is not found by id', async () => {
    model.findById.mockReturnValueOnce(createQueryMock(null));

    const result = await repository.findById('missing-table-id');

    expect(model.findById).toHaveBeenCalledWith('missing-table-id');
    expect(result).toBeNull();
  });

  it('finds tables by supported search criteria', async () => {
    const query = createQueryMock([document]);
    model.find.mockReturnValueOnce(query);

    const result = await repository.findMany({
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      systemName: 'dnd5e',
      status: 'active',
      playerDiscordId: 'discord-player-1',
      limit: 10,
      skip: 20,
    });

    expect(model.find).toHaveBeenCalledWith({
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      systemName: 'dnd5e',
      status: 'active',
      'players.userDiscordId': 'discord-player-1',
    });
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Table);
  });

  it('finds tables without filters', async () => {
    const query = createQueryMock([document]);
    model.find.mockReturnValueOnce(query);

    const result = await repository.findMany({});

    expect(model.find).toHaveBeenCalledWith({});
    expect(query.skip).not.toHaveBeenCalled();
    expect(query.limit).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
