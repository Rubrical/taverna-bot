import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';

import { CustomLoggerService } from '../../../../src/modules/logger/infrastructure/logger.service';
import { RABBITMQ_SERVICE } from '../../../../src/common/constants/injection-tokens';
import { SYSTEM_LOGS_QUEUE } from '../../../../src/common/constants/queue-names';

describe('CustomLoggerService', () => {
  let service: CustomLoggerService;
  let rmqClient: jest.Mocked<Pick<ClientProxy, 'emit'>>;

  beforeEach(async () => {
    rmqClient = {
      emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomLoggerService,
        {
          provide: RABBITMQ_SERVICE,
          useValue: rmqClient,
        },
      ],
    }).compile();

    service = module.get<CustomLoggerService>(CustomLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log()', () => {
    it('should write to console and emit to RabbitMQ', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.log('Test message', 'TestContext');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(rmqClient.emit).toHaveBeenCalledWith(
        SYSTEM_LOGS_QUEUE,
        expect.objectContaining({
          level: 'log',
          message: 'Test message',
          context: 'TestContext',
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error()', () => {
    it('should write to stderr and emit with trace metadata', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.error('Something failed', 'stack trace here', 'ErrorContext');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(rmqClient.emit).toHaveBeenCalledWith(
        SYSTEM_LOGS_QUEUE,
        expect.objectContaining({
          level: 'error',
          message: 'Something failed',
          context: 'ErrorContext',
          metadata: { trace: 'stack trace here' },
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('warn()', () => {
    it('should write to console.warn and emit to RabbitMQ', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.warn('Warning message');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(rmqClient.emit).toHaveBeenCalledWith(
        SYSTEM_LOGS_QUEUE,
        expect.objectContaining({
          level: 'warn',
          message: 'Warning message',
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('debug()', () => {
    it('should write to console.debug and emit to RabbitMQ', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      service.debug('Debug info', 'DebugCtx');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(rmqClient.emit).toHaveBeenCalledWith(
        SYSTEM_LOGS_QUEUE,
        expect.objectContaining({
          level: 'debug',
          message: 'Debug info',
          context: 'DebugCtx',
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('verbose()', () => {
    it('should write to console.log and emit to RabbitMQ', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.verbose('Verbose details');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(rmqClient.emit).toHaveBeenCalledWith(
        SYSTEM_LOGS_QUEUE,
        expect.objectContaining({
          level: 'verbose',
          message: 'Verbose details',
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('log entry structure', () => {
    it('should include a valid ISO timestamp', () => {
      jest.spyOn(console, 'log').mockImplementation();

      service.log('Timestamp test');

      const emittedEntry: any = (rmqClient.emit as jest.Mock).mock.calls[0][1];
      expect(emittedEntry.timestamp).toBeDefined();
      expect(new Date(emittedEntry.timestamp).toISOString()).toBe(
        emittedEntry.timestamp,
      );

      jest.restoreAllMocks();
    });
  });
});
