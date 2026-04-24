import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { LOGS_CONNECTION } from '../../../database/database.constants.js';
import type { LogEntry } from '../../logger/domain/interfaces/log-entry.interface.js';
import { SystemLog, type SystemLogDocument } from '../domain/schemas/system-log.schema.js';

@Injectable()
export class LogProcessorRepository {
  constructor(
    @InjectModel(SystemLog.name, LOGS_CONNECTION)
    private readonly systemLogModel: Model<SystemLogDocument>,
  ) {}

  async save(entry: LogEntry): Promise<SystemLogDocument> {
    const document = new this.systemLogModel(entry);
    return document.save();
  }
}
