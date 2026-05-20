import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Table, type TableRestore } from '../../domain/entities/table.entity.js';
import { TablePlayer, type TablePlayerRestore } from '../../domain/entities/table-player.entity.js';
import { TablePersistence, type TableDocument } from '../../domain/schemas/table.schema.js';
import type { TablePlayerPersistence } from '../../domain/schemas/table-player.schema.js';

export interface TableSearchCriteria {
  readonly guildDiscordId?: string;
  readonly masterDiscordId?: string;
  readonly systemName?: string;
  readonly status?: TableDocument['status'];
  readonly playerDiscordId?: string;
  readonly limit?: number;
  readonly skip?: number;
}

type TableSearchQuery = {
  guildDiscordId?: string;
  masterDiscordId?: string;
  systemName?: string;
  status?: TableDocument['status'];
  'players.userDiscordId'?: string;
};

type TablePlayerPersistenceData = {
  readonly _id?: unknown;
  readonly username: string;
  readonly userDiscordId: string;
  readonly status: TablePlayerPersistence['status'];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type TablePersistenceData = {
  readonly _id?: unknown;
  readonly name?: string;
  readonly version: number;
  readonly systemName: string;
  readonly guildDiscordId: string;
  readonly masterDiscordId: string;
  readonly players: readonly TablePlayerPersistenceData[];
  readonly status: TableDocument['status'];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt?: Date;
};

@Injectable()
export class TableRepository {
  constructor(
    @InjectModel(TablePersistence.name)
    private readonly tableModel: Model<TableDocument>,
  ) {}

  async save(table: Table): Promise<Table> {
    const document = new this.tableModel(this.toPersistence(table));
    const savedDocument = await document.save();

    return this.toDomain(savedDocument);
  }

  async findById(id: string): Promise<Table | null> {
    const document = await this.tableModel.findById(id).exec();
    if (!document) {
      return null;
    }

    return this.toDomain(document);
  }

  async findMany(criteria: TableSearchCriteria): Promise<readonly Table[]> {
    const query = this.createSearchQuery(criteria);
    const findQuery = this.tableModel.find(query);

    if (criteria.skip) {
      findQuery.skip(criteria.skip);
    }

    if (criteria.limit) {
      findQuery.limit(criteria.limit);
    }

    const documents = await findQuery.exec();

    return documents.map((document) => this.toDomain(document));
  }

  private createSearchQuery(criteria: TableSearchCriteria): TableSearchQuery {
    const query: TableSearchQuery = {};

    if (criteria.guildDiscordId) {
      query.guildDiscordId = criteria.guildDiscordId;
    }

    if (criteria.masterDiscordId) {
      query.masterDiscordId = criteria.masterDiscordId;
    }

    if (criteria.systemName) {
      query.systemName = criteria.systemName;
    }

    if (criteria.status) {
      query.status = criteria.status;
    }

    if (criteria.playerDiscordId) {
      query['players.userDiscordId'] = criteria.playerDiscordId;
    }

    return query;
  }

  private toPersistence(table: Table): Omit<TablePersistenceData, '_id'> & { readonly _id?: string } {
    return {
      _id: table.id,
      name: table.name,
      version: table.version,
      systemName: table.systemName,
      guildDiscordId: table.guildDiscordId,
      masterDiscordId: table.masterDiscordId,
      players: table.players.map((player) => ({
        _id: player.id,
        username: player.username,
        userDiscordId: player.userDiscordId,
        status: player.status,
        version: player.version,
        createdAt: player.createdAt,
        updatedAt: player.updatedAt,
      })),
      status: table.status,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
      archivedAt: table.archivedAt,
    };
  }

  private toDomain(document: TablePersistenceData): Table {
    const props: TableRestore = {
      id: this.getDocumentId(document),
      name: document.name,
      version: document.version,
      systemName: document.systemName,
      guildDiscordId: document.guildDiscordId,
      masterDiscordId: document.masterDiscordId,
      players: document.players.map((player) => this.toDomainPlayer(player)),
      status: document.status,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      archivedAt: document.archivedAt,
    };

    return Table.restore(props);
  }

  private toDomainPlayer(document: TablePlayerPersistenceData): TablePlayer {
    const props: TablePlayerRestore = {
      id: this.getDocumentId(document),
      username: document.username,
      userDiscordId: document.userDiscordId,
      status: document.status,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };

    return TablePlayer.restore(props);
  }

  private getDocumentId(document: { readonly _id?: unknown }): string {
    return String(document._id);
  }
}
