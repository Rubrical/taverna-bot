import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { LogEntry } from '../../../logger/domain/interfaces/log-entry.interface.js';
import type {
  LogProcessorRepositoryPort,
  SystemLogSearchCriteria,
} from '../domain/interfaces/log-processor-repository.interface.js';
import { SystemLog, type SystemLogDocument } from '../domain/schemas/system-log.schema.js';

type SystemLogSearchQuery = {
  level?: SystemLogDocument['level'];
  context?: string;
  message?: {
    $regex: string;
    $options: string;
  };
  timestamp?: {
    $gte?: string;
    $lte?: string;
  };
  'metadata.userId'?: string;
};

@Injectable()
export class LogProcessorRepository implements LogProcessorRepositoryPort {
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
    return this.systemLogModel.find(query).exec();
  }

  private createSearchQuery(criteria: SystemLogSearchCriteria): SystemLogSearchQuery {
    const query: SystemLogSearchQuery = {};

    if (criteria.level) {
      query.level = criteria.level;
    }

    if (criteria.context) {
      query.context = criteria.context;
    }

    if (criteria.userId) {
      query['metadata.userId'] = criteria.userId;
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
