import type { Model } from 'mongoose';

import type { LogEntry } from '../../../src/logger/domain/interfaces/log-entry.interface.js';
import type { SystemLogSearchCriteria } from '../../../src/logger/domain/interfaces/system-log-repository.interface.js';
import type { SystemLogDocument } from '../../../src/logger/domain/schemas/system-log.schema.js';
import { SystemLogRepository } from '../../../src/logger/infrastructure/system-log.repository.js';

type QueryMock<TResult> = {
  limit: jest.Mock<QueryMock<TResult>, [number]>;
  skip: jest.Mock<QueryMock<TResult>, [number]>;
  sort: jest.Mock<QueryMock<TResult>, [Record<string, 1 | -1>]>;
  exec: jest.Mock<Promise<TResult>, []>;
};

type SystemLogModelMock = jest.Mock & {
  findById: jest.Mock<QueryMock<SystemLogDocument | null>, [string]>;
  find: jest.Mock<QueryMock<SystemLogDocument[]>, [Record<string, unknown>]>;
  countDocuments: jest.Mock<QueryMock<number>, [Record<string, unknown>]>;
};

function createQueryMock<TResult>(result: TResult): QueryMock<TResult> {
  const query = {
    limit: jest.fn<QueryMock<TResult>, [number]>(),
    skip: jest.fn<QueryMock<TResult>, [number]>(),
    sort: jest.fn<QueryMock<TResult>, [Record<string, 1 | -1>]>(),
    exec: jest.fn<Promise<TResult>, []>().mockResolvedValue(result),
  };

  query.limit.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.sort.mockReturnValue(query);

  return query;
}

function createSystemLogModelMock(saveResult: SystemLogDocument): {
  readonly model: SystemLogModelMock;
  readonly save: jest.Mock<Promise<SystemLogDocument>, []>;
} {
  const save = jest.fn<Promise<SystemLogDocument>, []>().mockResolvedValue(saveResult);
  const model = jest.fn().mockImplementation((entry: LogEntry) => ({
    ...entry,
    save,
  })) as SystemLogModelMock;

  model.findById = jest.fn<QueryMock<SystemLogDocument | null>, [string]>();
  model.find = jest.fn<QueryMock<SystemLogDocument[]>, [Record<string, unknown>]>();
  model.countDocuments = jest.fn<QueryMock<number>, [Record<string, unknown>]>();

  return { model, save };
}

describe('SystemLogRepository', () => {
  let document: SystemLogDocument;
  let model: SystemLogModelMock;
  let save: jest.Mock<Promise<SystemLogDocument>, []>;
  let repository: SystemLogRepository;

  beforeEach(() => {
    document = {
      level: 'error',
      message: 'Runtime exception',
      context: 'RuntimeHandler',
      timestamp: '2026-05-06T13:00:00.000Z',
      metadata: { userId: 'user-123' },
    } as unknown as SystemLogDocument;

    const modelMock = createSystemLogModelMock(document);
    model = modelMock.model;
    save = modelMock.save;
    repository = new SystemLogRepository(model as unknown as Model<SystemLogDocument>);
  });

  it('should save a log entry', async () => {
    const entry: LogEntry = {
      level: 'error',
      message: 'Runtime exception',
      context: 'RuntimeHandler',
      timestamp: '2026-05-06T13:00:00.000Z',
      metadata: { userId: 'user-123' },
    };

    const result = await repository.save(entry);

    expect(model).toHaveBeenCalledWith(entry);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result).toBe(document);
  });

  it('should find a log by id', async () => {
    model.findById.mockReturnValueOnce(createQueryMock(document));

    const result = await repository.findById('log-123');

    expect(model.findById).toHaveBeenCalledWith('log-123');
    expect(result).toBe(document);
  });

  it('should find logs without filters', async () => {
    const query = createQueryMock([document]);
    model.find.mockReturnValueOnce(query);

    const result = await repository.findMany({});

    expect(model.find).toHaveBeenCalledWith({});
    expect(query.sort).toHaveBeenCalledWith({ timestamp: -1 });
    expect(query.limit).not.toHaveBeenCalled();
    expect(result).toEqual([document]);
  });

  it('should find logs by supported search criteria', async () => {
    const criteria: SystemLogSearchCriteria = {
      level: 'error',
      context: 'RuntimeHandler',
      userId: 'user-123',
      from: '2026-05-06T00:00:00.000Z',
      to: '2026-05-06T23:59:59.999Z',
      message: 'exception',
      kind: 'audit',
      guildId: 'guild-123',
      actorUserId: 'actor-123',
      limit: 10,
      skip: 20,
      sortDirection: 'desc',
    };
    const query = createQueryMock([document]);
    model.find.mockReturnValueOnce(query);

    await repository.findMany(criteria);

    expect(model.find).toHaveBeenCalledWith({
      level: 'error',
      context: 'RuntimeHandler',
      kind: 'audit',
      'metadata.userId': 'user-123',
      'metadata.guildId': 'guild-123',
      'metadata.actorUserId': 'actor-123',
      message: { $regex: 'exception', $options: 'i' },
      timestamp: {
        $gte: '2026-05-06T00:00:00.000Z',
        $lte: '2026-05-06T23:59:59.999Z',
      },
    });
    expect(query.sort).toHaveBeenCalledWith({ timestamp: -1 });
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('should sort logs by timestamp ascending when requested', async () => {
    const query = createQueryMock([document]);
    model.find.mockReturnValueOnce(query);

    await repository.findMany({ sortDirection: 'asc' });

    expect(query.sort).toHaveBeenCalledWith({ timestamp: 1 });
  });

  it('should count logs by supported search criteria', async () => {
    const query = createQueryMock(7);
    model.countDocuments.mockReturnValueOnce(query);

    const result = await repository.count({
      kind: 'audit',
      guildId: 'guild-123',
      actorUserId: 'actor-123',
    });

    expect(model.countDocuments).toHaveBeenCalledWith({
      kind: 'audit',
      'metadata.guildId': 'guild-123',
      'metadata.actorUserId': 'actor-123',
    });
    expect(result).toBe(7);
  });
});
