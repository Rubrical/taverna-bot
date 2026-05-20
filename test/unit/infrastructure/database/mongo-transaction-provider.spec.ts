import type { Connection } from 'mongoose';

import { MongoTransactionProvider } from '../../../../src/infrastructure/database/mongo-transaction-provider.js';
import { TavernaLogger } from '../../../../src/logger/infrastructure/taverna-logger.service.js';

type TransactionWork = () => Promise<unknown>;

type ConnectionMock = {
  transaction: jest.Mock<Promise<unknown>, [TransactionWork]>;
};

type TavernaLoggerMock = {
  error: jest.Mock<void, [string, Error, string]>;
};

describe('MongoTransactionProvider', () => {
  let connection: ConnectionMock;
  let logger: TavernaLoggerMock;
  let provider: MongoTransactionProvider;

  beforeEach(() => {
    connection = {
      transaction: jest.fn<Promise<unknown>, [TransactionWork]>((work) => work()),
    };
    logger = {
      error: jest.fn<void, [string, Error, string]>(),
    };

    provider = new MongoTransactionProvider(connection as unknown as Connection, logger as unknown as TavernaLogger);
  });

  it('runs work inside a Mongo transaction and returns its result', async () => {
    const work = jest.fn<Promise<string>, []>().mockResolvedValue('done');

    const result = await provider.run(work);

    expect(connection.transaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledTimes(1);
    expect(result).toBe('done');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and rethrows errors raised by the transaction work', async () => {
    const error = new Error('failed');
    const work = jest.fn<Promise<string>, []>().mockRejectedValue(error);

    await expect(provider.run(work)).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith('A transaction error occurred', error, MongoTransactionProvider.name);
  });

  it('logs non-error throwables as Error instances and rethrows the original value', async () => {
    const work = jest.fn<Promise<string>, []>().mockRejectedValue('failed');

    await expect(provider.run(work)).rejects.toBe('failed');

    expect(logger.error).toHaveBeenCalledWith(
      'A transaction error occurred',
      expect.objectContaining({ message: 'failed' }),
      MongoTransactionProvider.name,
    );
  });
});
