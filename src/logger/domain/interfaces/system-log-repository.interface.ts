import type { Repository } from '../../../common/repositories/repository.interface.js';
import type { LogLevel } from '../../../common/types/index.js';
import type { LogEntry } from './log-entry.interface.js';
import type { SystemLogDocument } from '../schemas/system-log.schema.js';

export const SYSTEM_LOG_REPOSITORY = Symbol('SYSTEM_LOG_REPOSITORY');

export interface SystemLogSearchCriteria {
  readonly level?: LogLevel;
  readonly context?: string;
  readonly userId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly message?: string;
}

export interface SystemLogRepositoryPort extends Repository<LogEntry, SystemLogDocument, string, SystemLogSearchCriteria> {
  save(entry: LogEntry): Promise<SystemLogDocument>;
  findById(id: string): Promise<SystemLogDocument | null>;
  findMany(criteria: SystemLogSearchCriteria): Promise<readonly SystemLogDocument[]>;
}
