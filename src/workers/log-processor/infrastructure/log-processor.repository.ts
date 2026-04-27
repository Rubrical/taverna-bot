import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { LogEntry } from '../../../logger/domain/interfaces/log-entry.interface';
import { SystemLog, type SystemLogDocument } from '../domain/schemas/system-log.schema';

@Injectable()
export class LogProcessorRepository {
  constructor(
    @InjectModel(SystemLog.name)
    private readonly systemLogModel: Model<SystemLogDocument>,
  ) {}

  async save(entry: LogEntry): Promise<SystemLogDocument> {
    const document = new this.systemLogModel(entry);
    return document.save();
  }
}
