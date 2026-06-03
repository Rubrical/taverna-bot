import { Injectable } from '@nestjs/common';

import { MongoTransactionProvider } from '../../../infrastructure/database/mongo-transaction-provider.js';
import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import { Table, type TableCreate } from '../domain/entities/table.entity.js';
import { TablePlayer } from '../domain/entities/table-player.entity.js';
import { TableNotFoundError } from '../domain/errors/table-not-found-error.js';
import { TableOperationFailedError } from '../domain/errors/table-operation-failed-error.js';
import { TableRepository, type TableSearchCriteria } from '../infrastructure/repositories/table.repository.js';

@Injectable()
export class TableService {
  constructor(
    private readonly _repository: TableRepository,
    private readonly _transactionProvider: MongoTransactionProvider,
    private readonly _logger: TavernaLogger,
  ) {
    this._logger.setContext(TableService.name);
  }

  async createTable(input: TableCreate): Promise<Table> {
    return this.runAuditTransaction('create-table', async () => {
      const table = new Table(input);
      const savedTable = await this._repository.save(table);

      this._logger.log('Table created', {
        tableId: savedTable.id,
        guildDiscordId: savedTable.guildDiscordId,
        kind: 'audit',
      });

      return savedTable;
    });
  }

  async findTableById(tableId: string): Promise<Table | null> {
    return this._repository.findById(tableId);
  }

  async findTables(criteria: TableSearchCriteria): Promise<readonly Table[]> {
    return this._repository.findMany(criteria);
  }

  async addPlayer(
    tableId: string,
    playerName: string,
    playerDiscordId: string,
    requesterDiscordId: string,
  ): Promise<Table> {
    return this.runAuditTransaction('add-table-player', async () => {
      const table = await this.getExistingTable(tableId);
      table.addPlayer(new TablePlayer(playerName, playerDiscordId), requesterDiscordId);
      const savedTable = await this._repository.save(table);

      this._logger.log('Player added to table', {
        tableId: savedTable.id,
        playerDiscordId,
        requesterDiscordId,
        kind: 'audit',
      });

      return savedTable;
    });
  }

  async inactivatePlayer(tableId: string, playerDiscordId: string, requesterDiscordId: string): Promise<Table> {
    return this.runAuditTransaction('inactivate-table-player', async () => {
      const table = await this.getExistingTable(tableId);
      table.inactivatePlayer(playerDiscordId, requesterDiscordId);
      const savedTable = await this._repository.save(table);

      this._logger.log('Player inactivated at table', {
        tableId: savedTable.id,
        playerDiscordId,
        requesterDiscordId,
        kind: 'audit',
      });

      return savedTable;
    });
  }

  async reactivatePlayer(tableId: string, playerDiscordId: string, requesterDiscordId: string): Promise<Table> {
    return this.runAuditTransaction('reactivate-table-player', async () => {
      const table = await this.getExistingTable(tableId);
      table.reactivatePlayer(playerDiscordId, requesterDiscordId);
      const savedTable = await this._repository.save(table);

      this._logger.log('Player reactivated at table', {
        tableId: savedTable.id,
        playerDiscordId,
        requesterDiscordId,
        kind: 'audit',
      });

      return savedTable;
    });
  }

  async banPlayer(tableId: string, playerDiscordId: string, requesterDiscordId: string): Promise<Table> {
    return this.runAuditTransaction('ban-table-player', async () => {
      const table = await this.getExistingTable(tableId);
      table.banPlayer(playerDiscordId, requesterDiscordId);
      const savedTable = await this._repository.save(table);

      this._logger.log('Player banned at table', {
        tableId: savedTable.id,
        playerDiscordId,
        requesterDiscordId,
        kind: 'audit',
      });

      return savedTable;
    });
  }

  async archiveTable(tableId: string): Promise<Table> {
    return this.runAuditTransaction('archive-table', async () => {
      const table = await this.getExistingTable(tableId);
      table.archive();
      const savedTable = await this._repository.save(table);

      this._logger.log('Table archived', { tableId: savedTable.id, kind: 'audit' });

      return savedTable;
    });
  }

  async unarchiveTable(tableId: string): Promise<Table> {
    return this.runAuditTransaction('unarchive-table', async () => {
      const table = await this.getExistingTable(tableId);
      table.unarchive();
      const savedTable = await this._repository.save(table);

      this._logger.log('Table unarchived', { tableId: savedTable.id, kind: 'audit' });

      return savedTable;
    });
  }

  private async getExistingTable(tableId: string): Promise<Table> {
    const table = await this._repository.findById(tableId);
    if (table) {
      return table;
    }

    this._logger.warn('Table not found', { tableId, kind: 'audit' });

    throw new TableNotFoundError(tableId);
  }

  private async runAuditTransaction<T>(operation: string, work: () => Promise<T>): Promise<T> {
    return this._transactionProvider.run(async () => {
      try {
        return await work();
      } catch (error) {
        this._logger.error('Table operation failed', this.normalizeError(error), { kind: 'audit', operation });
        throw error;
      }
    });
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new TableOperationFailedError(String(error));
  }
}
