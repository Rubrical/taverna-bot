import { Test, TestingModule } from '@nestjs/testing';
import type { RmqContext } from '@nestjs/microservices';

import { LogProcessorController } from '../../../src/workers/log-processor/infrastructure/log-processor.controller';
import { LogProcessorRepository } from '../../../src/workers/log-processor/infrastructure/log-processor.repository';
import type { LogEntry } from '../../../src/logger/domain/interfaces/log-entry.interface';

type LogProcessorRepositoryMock = {
  save: jest.Mock<Promise<void>, [LogEntry]>;
};

type RmqContextMock = {
  channel: {
    ack: jest.Mock<void, [unknown]>;
    nack: jest.Mock<void, [unknown, boolean, boolean]>;
  };
  context: RmqContext;
  message: unknown;
};

function createSaveMock(): LogProcessorRepositoryMock['save'] {
  return jest.fn<Promise<void>, [LogEntry]>().mockResolvedValue(undefined);
}

function createRmqContextMock(): RmqContextMock {
  const channel = {
    ack: jest.fn<void, [unknown]>(),
    nack: jest.fn<void, [unknown, boolean, boolean]>(),
  };
  const message = { fields: { deliveryTag: 1 } };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as RmqContext;

  return {
    channel,
    context,
    message,
  };
}

describe('LogProcessorController', () => {
  let controller: LogProcessorController;
  let repository: LogProcessorRepositoryMock;
  let rmqContext: RmqContextMock;

  beforeEach(async () => {
    const mockRepository: LogProcessorRepositoryMock = {
      save: createSaveMock(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogProcessorController],
      providers: [
        {
          provide: LogProcessorRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    controller = module.get<LogProcessorController>(LogProcessorController);
    repository = module.get<LogProcessorRepositoryMock>(LogProcessorRepository);
    rmqContext = createRmqContextMock();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleSystemLog()', () => {
    it('should save the log entry via repository', async () => {
      const entry: LogEntry = {
        level: 'log',
        message: 'Test log message',
        context: 'TestContext',
        timestamp: new Date().toISOString(),
        metadata: { key: 'value' },
      };

      await controller.handleSystemLog(entry, rmqContext.context);

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(entry);
      expect(rmqContext.channel.ack).toHaveBeenCalledWith(rmqContext.message);
      expect(rmqContext.channel.nack).not.toHaveBeenCalled();
    });

    it('should handle error-level logs with trace metadata', async () => {
      const entry: LogEntry = {
        level: 'error',
        message: 'Something broke',
        context: 'ErrorHandler',
        timestamp: new Date().toISOString(),
        metadata: { trace: 'Error: stack trace...' },
      };

      await controller.handleSystemLog(entry, rmqContext.context);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          metadata: { trace: 'Error: stack trace...' },
        }),
      );
    });

    it('should handle entries without optional fields', async () => {
      const entry: LogEntry = {
        level: 'debug',
        message: 'Minimal entry',
        timestamp: new Date().toISOString(),
      };

      await controller.handleSystemLog(entry, rmqContext.context);

      expect(repository.save).toHaveBeenCalledWith(entry);
    });

    it('should requeue the message when saving fails', async () => {
      const entry: LogEntry = {
        level: 'error',
        message: 'Failed entry',
        timestamp: new Date().toISOString(),
      };
      repository.save.mockRejectedValueOnce(new Error('database unavailable'));

      await controller.handleSystemLog(entry, rmqContext.context);

      expect(rmqContext.channel.ack).not.toHaveBeenCalled();
      expect(rmqContext.channel.nack).toHaveBeenCalledWith(rmqContext.message, false, true);
    });
  });
});
