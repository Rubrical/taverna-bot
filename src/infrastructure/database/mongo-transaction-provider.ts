import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TavernaLogger } from '../../logger/infrastructure/taverna-logger.service';

@Injectable()
export class MongoTransactionProvider {
  constructor(
    @InjectConnection()
    private readonly _connection: Connection,
    private readonly _logger: TavernaLogger,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    return this._connection.transaction(async () => {
      try {
        return await work();
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        this._logger.error('A transaction error occurred', error, MongoTransactionProvider.name);
        throw e;
      }
    });
  }
}
