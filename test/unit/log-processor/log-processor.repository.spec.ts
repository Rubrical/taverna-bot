import type { Model } from 'mongoose';

import type { LogEntry } from '../../../src/logger/domain/interfaces/log-entry.interface.js';
import type { SystemLogSearchCriteria } from '../../../src/workers/log-processor/domain/interfaces/log-processor-repository.interface.js';
import { LogProcessorRepository } from '../../../src/workers/log-processor/infrastructure/log-processor.repository.js';
import type { SystemLogDocument } from '../../../src/workers/log-processor/domain/schemas/system-log.schema.js';

type QueryMock<TResult> = {
  exec: jest.Mock<Promise<TResult>, []>;
};

type SystemLogModelMock = jest.Mock & {
  findById: jest.Mock<QueryMock<SystemLogDocument | null>, [string]>;
  find: jest.Mock<QueryMock<SystemLogDocument[]>, [Record<string, unknown>]>;
};

function createQueryMock<TResult>(result: TResult): QueryMock<TResult> {
  return {
    exec: jest.fn<Promise<TResult>, []>().mockResolvedValue(result),
  };
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

  return { model, save };
}

describe('LogProcessorRepository', () => {
  let document: SystemLogDocument;
  let model: SystemLogModelMock;
  let save: jest.Mock<Promise<SystemLogDocument>, []>;
  let repository: LogProcessorRepository;

  beforeEach(() => {
    document = {
      level: 'error',
      message: 'Runtime exception',
      context: 'RuntimeHandler',
      timestamp: '2026-05-06T13:00:00.000Z',
      metadata: { userId: 'user-123' },
    } as SystemLogDocument;

    const modelMock = createSystemLogModelMock(document);
    model = modelMock.model;
    save = modelMock.save;
    repository = new LogProcessorRepository(model as unknown as Model<SystemLogDocument>);
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
    model.find.mockReturnValueOnce(createQueryMock([document]));

    const result = await repository.findMany({});

    expect(model.find).toHaveBeenCalledWith({});
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
    };
    model.find.mockReturnValueOnce(createQueryMock([document]));

    await repository.findMany(criteria);

    expect(model.find).toHaveBeenCalledWith({
      level: 'error',
      context: 'RuntimeHandler',
      'metadata.userId': 'user-123',
      message: { $regex: 'exception', $options: 'i' },
      timestamp: {
        $gte: '2026-05-06T00:00:00.000Z',
        $lte: '2026-05-06T23:59:59.999Z',
      },
    });
  });
});
