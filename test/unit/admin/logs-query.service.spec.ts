import { Test, type TestingModule } from '@nestjs/testing';

import { LogsQueryService } from '../../../src/admin/application/logs-query.service.js';
import {
  SYSTEM_LOG_REPOSITORY,
  type SystemLogRepositoryPort,
} from '../../../src/logger/domain/interfaces/system-log-repository.interface.js';
import type { SystemLogDocument } from '../../../src/logger/domain/schemas/system-log.schema.js';

type SystemLogRepositoryMock = {
  readonly findMany: jest.Mock<Promise<readonly SystemLogDocument[]>, Parameters<SystemLogRepositoryPort['findMany']>>;
  readonly count: jest.Mock<Promise<number>, Parameters<SystemLogRepositoryPort['count']>>;
};

describe('LogsQueryService', () => {
  let service: LogsQueryService;
  let systemLogRepository: SystemLogRepositoryMock;

  beforeEach(async () => {
    systemLogRepository = {
      findMany: jest.fn<Promise<readonly SystemLogDocument[]>, Parameters<SystemLogRepositoryPort['findMany']>>(),
      count: jest.fn<Promise<number>, Parameters<SystemLogRepositoryPort['count']>>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsQueryService,
        {
          provide: SYSTEM_LOG_REPOSITORY,
          useValue: systemLogRepository,
        },
      ],
    }).compile();

    service = module.get<LogsQueryService>(LogsQueryService);
  });

  it('should find recent logs without filters', async () => {
    systemLogRepository.count.mockResolvedValue(21);
    systemLogRepository.findMany.mockResolvedValue([]);

    const result = await service.findRecentLogs({});

    expect(systemLogRepository.count).toHaveBeenCalledWith({});
    expect(systemLogRepository.findMany).toHaveBeenCalledWith({
      limit: 10,
      skip: 0,
      sortDirection: 'desc',
    });
    expect(result).toEqual({
      logs: [],
      page: 1,
      pageSize: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it('should find logs by kind', async () => {
    systemLogRepository.count.mockResolvedValue(11);
    systemLogRepository.findMany.mockResolvedValue([]);

    await service.findRecentLogs({ searchItem: 'kind', param: 'audit', page: 2 });

    expect(systemLogRepository.count).toHaveBeenCalledWith({
      kind: 'audit',
    });
    expect(systemLogRepository.findMany).toHaveBeenCalledWith({
      kind: 'audit',
      limit: 10,
      skip: 10,
      sortDirection: 'desc',
    });
  });

  it('should find logs by guild id', async () => {
    systemLogRepository.count.mockResolvedValue(1);
    systemLogRepository.findMany.mockResolvedValue([]);

    await service.findRecentLogs({ searchItem: 'guild-id', param: 'guild-123' });

    expect(systemLogRepository.count).toHaveBeenCalledWith({
      guildId: 'guild-123',
    });
    expect(systemLogRepository.findMany).toHaveBeenCalledWith({
      guildId: 'guild-123',
      limit: 10,
      skip: 0,
      sortDirection: 'desc',
    });
  });

  it('should find logs by actor user id', async () => {
    systemLogRepository.count.mockResolvedValue(1);
    systemLogRepository.findMany.mockResolvedValue([]);

    await service.findRecentLogs({ searchItem: 'actor-user-id', param: 'actor-123' });

    expect(systemLogRepository.count).toHaveBeenCalledWith({
      actorUserId: 'actor-123',
    });
    expect(systemLogRepository.findMany).toHaveBeenCalledWith({
      actorUserId: 'actor-123',
      limit: 10,
      skip: 0,
      sortDirection: 'desc',
    });
  });

  it('should clamp requested page to the last available page', async () => {
    systemLogRepository.count.mockResolvedValue(11);
    systemLogRepository.findMany.mockResolvedValue([]);

    const result = await service.findRecentLogs({ page: 5 });

    expect(systemLogRepository.findMany).toHaveBeenCalledWith({
      limit: 10,
      skip: 10,
      sortDirection: 'desc',
    });
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
  });
});
