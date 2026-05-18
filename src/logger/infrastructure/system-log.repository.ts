import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { LogEntry } from '../domain/interfaces/log-entry.interface.js';
import type {
  SystemLogRepositoryPort,
  SystemLogSearchCriteria,
} from '../domain/interfaces/system-log-repository.interface.js';
import { SystemLog, type SystemLogDocument } from '../domain/schemas/system-log.schema.js';

type SystemLogSearchQuery = {
  level?: SystemLogDocument['level'];
  context?: string;
  kind?: SystemLogDocument['kind'];
  message?: {
    $regex: string;
    $options: string;
  };
  timestamp?: {
    $gte?: string;
    $lte?: string;
  };
  'metadata.userId'?: string;
  'metadata.guildId'?: string;
  'metadata.actorUserId'?: string;
};

@Injectable()
export class SystemLogRepository implements SystemLogRepositoryPort {
  constructor(
    @InjectModel(SystemLog.name)
    private readonly systemLogModel: Model<SystemLogDocument>,
  ) {}

  async save(entry: LogEntry): Promise<SystemLogDocument> {
    const document = new this.systemLogModel(entry);
    return document.save();
  }

  async findById(id: string): Promise<SystemLogDocument | null> {
    return this.systemLogModel.findById(id).exec();
  }

  async findMany(criteria: SystemLogSearchCriteria): Promise<readonly SystemLogDocument[]> {
    const query = this.createSearchQuery(criteria);
    const sortDirection = criteria.sortDirection === 'asc' ? 1 : -1;
    const findQuery = this.systemLogModel.find(query).sort({ timestamp: sortDirection });

    if (criteria.skip) {
      findQuery.skip(criteria.skip);
    }

    if (!criteria.limit) {
      return findQuery.exec();
    }

    return findQuery.limit(criteria.limit).exec();
  }

  async count(criteria: SystemLogSearchCriteria): Promise<number> {
    return this.systemLogModel.countDocuments(this.createSearchQuery(criteria)).exec();
  }

  private createSearchQuery(criteria: SystemLogSearchCriteria): SystemLogSearchQuery {
    const query: SystemLogSearchQuery = {};

    if (criteria.level) {
      query.level = criteria.level;
    }

    if (criteria.context) {
      query.context = criteria.context;
    }

    if (criteria.kind) {
      query.kind = criteria.kind;
    }

    if (criteria.userId) {
      query['metadata.userId'] = criteria.userId;
    }

    if (criteria.guildId) {
      query['metadata.guildId'] = criteria.guildId;
    }

    if (criteria.actorUserId) {
      query['metadata.actorUserId'] = criteria.actorUserId;
    }

    if (criteria.message) {
      query.message = { $regex: criteria.message, $options: 'i' };
    }

    if (!criteria.from && !criteria.to) {
      return query;
    }

    query.timestamp = {};

    if (criteria.from) {
      query.timestamp.$gte = criteria.from;
    }

    if (criteria.to) {
      query.timestamp.$lte = criteria.to;
    }

    return query;
  }
}
