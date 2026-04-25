import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { TavernaLogger } from '../../../../src/modules/logger/infrastructure/logger.service';
import { LogPublisher } from '../../../../src/modules/logger/infrastructure/log-publisher.service';
import type { LogEntry } from '../../../../src/modules/logger/domain/interfaces/log-entry.interface';

type LogPublisherMock = {
  publish: jest.Mock<void, [LogEntry]>;
};

type ConfigServiceMock = {
  get: jest.Mock<string, [string, string]>;
};

describe('TavernaLogger', () => {
  let logger: TavernaLogger;
  let publisher: LogPublisherMock;
  let config: ConfigServiceMock;

  beforeEach(async () => {
    publisher = {
      publish: jest.fn<void, [LogEntry]>(),
    };
    config = {
      get: jest.fn<string, [string, string]>().mockReturnValue('Taverna Bot'),
    };

    jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation();
    jest.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation();
    jest.spyOn(ConsoleLogger.prototype, 'debug').mockImplementation();
    jest.spyOn(ConsoleLogger.prototype, 'verbose').mockImplementation();
    jest.spyOn(ConsoleLogger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TavernaLogger,
        {
          provide: LogPublisher,
          useValue: publisher,
        },
        {
          provide: ConfigService,
          useValue: config,
        },
      ],
    }).compile();

    logger = module.get<TavernaLogger>(TavernaLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should publish log entries with context set once', () => {
    logger.setContext('CharacterService');

    logger.log('Creating character', { userId: 'user-1' });

    expect(config.get).toHaveBeenCalledWith('APPLICATION_NAME', 'Taverna Bot');
    expect(ConsoleLogger.prototype.log).toHaveBeenCalledWith('Creating character', 'CharacterService');
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'log',
        message: 'Creating character',
        context: 'CharacterService',
        metadata: { userId: 'user-1' },
      }),
    );
  });

  it('should support explicit context for Nest logger compatibility', () => {
    logger.log('Application started', 'Bootstrap');

    expect(ConsoleLogger.prototype.log).toHaveBeenCalledWith('Application started', 'Bootstrap');
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'log',
        message: 'Application started',
        context: 'Bootstrap',
      }),
    );
  });

  it('should publish warning metadata', () => {
    logger.setContext('CacheService');

    logger.warn('Cache miss', { key: 'sheet:user-1' });

    expect(ConsoleLogger.prototype.warn).toHaveBeenCalledWith('Cache miss', 'CacheService');
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: 'Cache miss',
        context: 'CacheService',
        metadata: { key: 'sheet:user-1' },
      }),
    );
  });

  it('should publish Error details as structured metadata', () => {
    logger.setContext('CharacterService');
    const error = new Error('Database unavailable');

    logger.error('Failed to create character', error, { userId: 'user-1' });

    expect(ConsoleLogger.prototype.error).toHaveBeenCalledWith(
      'Failed to create character',
      error.stack,
      'CharacterService',
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'Failed to create character',
        context: 'CharacterService',
        metadata: {
          userId: 'user-1',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Database unavailable',
            stack: error.stack,
          }),
        },
      }),
    );
  });

  it('should keep legacy string stack support for error logs', () => {
    logger.setContext('Bootstrap');

    logger.error('Failed to bootstrap', 'stack trace');

    expect(ConsoleLogger.prototype.error).toHaveBeenCalledWith('Failed to bootstrap', 'stack trace', 'Bootstrap');
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'Failed to bootstrap',
        context: 'Bootstrap',
      }),
    );
  });

  it('should include a valid ISO timestamp', () => {
    logger.log('Timestamp test');

    const emittedEntry = publisher.publish.mock.calls[0]?.[0];
    expect(emittedEntry).toBeDefined();

    if (!emittedEntry) {
      return;
    }

    expect(new Date(emittedEntry.timestamp).toISOString()).toBe(emittedEntry.timestamp);
  });
});
