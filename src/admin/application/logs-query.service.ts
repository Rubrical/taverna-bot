import { Inject, Injectable } from '@nestjs/common';

import {
  SYSTEM_LOG_REPOSITORY,
  type SystemLogRepositoryPort,
  type SystemLogSearchCriteria,
} from '../../logger/domain/interfaces/system-log-repository.interface.js';
import type { LogKind } from '../../logger/domain/interfaces/log-entry.interface.js';
import type { SystemLogDocument } from '../../logger/domain/schemas/system-log.schema.js';

export type LogsSearchItem = 'kind' | 'guild-id' | 'actor-user-id';

export interface LogsQueryFilter {
  readonly searchItem?: LogsSearchItem;
  readonly param?: string;
  readonly page?: number;
}

export interface LogsQueryResult {
  readonly logs: readonly SystemLogDocument[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class LogsQueryService {
  private readonly pageSize = 10;

  constructor(
    @Inject(SYSTEM_LOG_REPOSITORY)
    private readonly systemLogRepository: SystemLogRepositoryPort,
  ) {}

  async findRecentLogs(filter: LogsQueryFilter): Promise<LogsQueryResult> {
    const criteria = this.createSearchCriteria(filter);
    const total = await this.systemLogRepository.count(criteria);
    const totalPages = Math.max(Math.ceil(total / this.pageSize), 1);
    const page = this.normalizePage(filter.page, totalPages);
    const logs = await this.systemLogRepository.findMany({
      ...criteria,
      limit: this.pageSize,
      skip: (page - 1) * this.pageSize,
      sortDirection: 'desc',
    });

    return {
      logs,
      page,
      pageSize: this.pageSize,
      total,
      totalPages,
    };
  }

  private createSearchCriteria(filter: LogsQueryFilter): SystemLogSearchCriteria {
    if (!filter.searchItem || !filter.param) {
      return {};
    }

    if (filter.searchItem === 'kind') {
      return { kind: filter.param as LogKind };
    }

    if (filter.searchItem === 'guild-id') {
      return { guildId: filter.param };
    }

    return { actorUserId: filter.param };
  }

  private normalizePage(page: number | undefined, totalPages: number): number {
    if (!page || page < 1) {
      return 1;
    }

    return Math.min(page, totalPages);
  }
}
