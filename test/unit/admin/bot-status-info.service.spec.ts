import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { execFile } from 'node:child_process';

import { BotStatusInfoService } from '../../../src/admin/application/bot-status-info.service';
import type { BotStatus } from '../../../src/admin/domain/bot-status-info';
import { cacheKeys } from '../../../src/infrastructure/cache/cache-keys';
import { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

type ConfigServiceMock = {
  getOrThrow: jest.Mock<string, [string]>;
};

type TavernaLoggerMock = {
  setContext: jest.Mock<void, [string]>;
  warn: jest.Mock<void, [unknown]>;
  error: jest.Mock<void, [unknown, unknown?]>;
};

type CacheMock = {
  readonly get: jest.Mock<Promise<BotStatus | undefined>, [string]>;
  readonly set: jest.Mock<Promise<void>, [string, BotStatus, number]>;
};

type ExecFileCallback = (error: Error | null, result?: { readonly stdout: string }) => void;

const mockedExecFile = execFile as unknown as jest.Mock<void, [string, readonly string[], ExecFileCallback]>;

describe('BotStatusInfoService', () => {
  let service: BotStatusInfoService;
  let config: ConfigServiceMock;
  let logger: TavernaLoggerMock;
  let cache: CacheMock;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-07T12:00:00.000Z'));

    mockedExecFile.mockImplementation((_file, _args, callback) => {
      callback(null, { stdout: 'abc1234\n' });
    });

    config = {
      getOrThrow: jest.fn<string, [string]>((key) => {
        const values: Record<string, string> = {
          APPLICATION_NAME: 'Taverna Bot',
          OWNER_ID: 'owner-1',
          OWNER_NAME: 'Filipe Salviano',
          npm_package_version: '1.2.3',
        };

        return values[key] ?? '';
      }),
    };

    logger = {
      setContext: jest.fn<void, [string]>(),
      warn: jest.fn<void, [unknown]>(),
      error: jest.fn<void, [unknown, unknown?]>(),
    };
    cache = {
      get: jest.fn<Promise<BotStatus | undefined>, [string]>(),
      set: jest.fn<Promise<void>, [string, BotStatus, number]>().mockResolvedValue(undefined),
    };

    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 128 * 1024 * 1024,
      heapTotal: 96 * 1024 * 1024,
      heapUsed: 64 * 1024 * 1024,
      external: 16 * 1024 * 1024,
      arrayBuffers: 8 * 1024 * 1024,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotStatusInfoService,
        {
          provide: CACHE_MANAGER,
          useValue: cache,
        },
        {
          provide: TavernaLogger,
          useValue: logger,
        },
        {
          provide: ConfigService,
          useValue: config,
        },
      ],
    }).compile();

    service = module.get<BotStatusInfoService>(BotStatusInfoService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should set the logger context on construction', () => {
    expect(service).toBeDefined();
    expect(logger.setContext).toHaveBeenCalledWith(BotStatusInfoService.name);
  });

  describe('getBasicApplicationInfo()', () => {
    it('should return application, runtime, and git status information', async () => {
      const status = await service.getBasicApplicationInfo();

      expect(mockedExecFile).toHaveBeenCalledWith('git', ['rev-parse', '--short', 'HEAD'], expect.any(Function));
      expect(config.getOrThrow).toHaveBeenCalledWith('APPLICATION_NAME');
      expect(config.getOrThrow).toHaveBeenCalledWith('OWNER_ID');
      expect(config.getOrThrow).toHaveBeenCalledWith('OWNER_NAME');
      expect(config.getOrThrow).toHaveBeenCalledWith('npm_package_version');
      expect(status).toEqual({
        lastCommitHash: 'abc1234',
        memoryUsage: 128,
        memoryHeapUsage: 64,
        nodeVersion: process.version,
        pid: process.pid,
        ppid: process.ppid,
        startedAt: new Date('2026-05-07T12:00:00.000Z'),
        status: 'healthy',
        version: '1.2.3',
        name: 'Taverna Bot',
        ownerId: 'owner-1',
        ownerName: 'Filipe Salviano',
      });
    });

    it('should return status without commit hash when git is unavailable', async () => {
      const error = new Error('git unavailable');
      mockedExecFile.mockImplementation((_file, _args, callback) => {
        callback(error);
      });

      const status = await service.getBasicApplicationInfo();

      expect(status.lastCommitHash).toBeUndefined();
      expect(status.status).toBe('healthy');
      expect(logger.warn).toHaveBeenCalledWith('Last commit hash was not available');
      expect(logger.error).toHaveBeenCalledWith('Exec error', error);
    });

    it('should include discord status when it is available', async () => {
      const discordBotStatus = {
        clientStatus: 'online',
        clientReadyAt: new Date('2026-05-07T12:01:00.000Z'),
        discordId: 'bot-1',
        discordName: 'Taverna',
        guilds: ['Guild One', 'Guild Two'],
      };

      await service.updateDiscordBotStatus(discordBotStatus);

      const status = await service.getBasicApplicationInfo();

      expect(status.discordBotStatus).toEqual(discordBotStatus);
    });

    it('should build complete status when discord status is updated before basic info is requested', async () => {
      const discordBotStatus = {
        clientStatus: 'online',
        clientReadyAt: new Date('2026-05-07T12:01:00.000Z'),
        discordId: 'bot-1',
        discordName: 'Taverna',
        guilds: ['Guild One'],
      };

      const status = await service.updateDiscordBotStatus(discordBotStatus);

      expect(status).toEqual(
        expect.objectContaining({
          name: 'Taverna Bot',
          version: '1.2.3',
          lastCommitHash: 'abc1234',
          discordBotStatus: discordBotStatus,
        }),
      );
    });
  });

  describe('getCachedBotStatusOrElseBasicApplicationInfo()', () => {
    it('should return cached bot status when it is available', async () => {
      const botStatus = await service.getBasicApplicationInfo();
      cache.get.mockResolvedValue(botStatus);

      const cachedBotStatus = await service.getCachedBotStatusOrElseBasicApplicationInfo();

      expect(cache.get).toHaveBeenCalledWith(cacheKeys.bot.status());
      expect(cache.set).not.toHaveBeenCalled();
      expect(cachedBotStatus).toBe(botStatus);
    });

    it('should rebuild and cache bot status when cache is empty', async () => {
      cache.get.mockResolvedValue(undefined);

      const botStatus = await service.getCachedBotStatusOrElseBasicApplicationInfo();

      expect(logger.warn).toHaveBeenCalledWith('Bot status cache miss. Rebuilding bot status info.');
      expect(cache.set).toHaveBeenCalledWith(cacheKeys.bot.status(), botStatus, 0);
      expect(botStatus.name).toBe('Taverna Bot');
    });
  });
});
