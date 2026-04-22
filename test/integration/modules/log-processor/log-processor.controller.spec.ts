import { Test, TestingModule } from '@nestjs/testing';

import { LogProcessorController } from '../../../../src/modules/log-processor/infrastructure/log-processor.controller';
import { LogProcessorRepository } from '../../../../src/modules/log-processor/infrastructure/log-processor.repository';
import type { LogEntry } from '../../../../src/modules/logger/domain/interfaces/log-entry.interface';

describe('LogProcessorController', () => {
  let controller: LogProcessorController;
  let repository: jest.Mocked<LogProcessorRepository>;

  beforeEach(async () => {
    const mockRepository = {
      save: jest.fn().mockResolvedValue(undefined),
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
    repository = module.get(LogProcessorRepository);
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

      await controller.handleSystemLog(entry);

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(entry);
    });

    it('should handle error-level logs with trace metadata', async () => {
      const entry: LogEntry = {
        level: 'error',
        message: 'Something broke',
        context: 'ErrorHandler',
        timestamp: new Date().toISOString(),
        metadata: { trace: 'Error: stack trace...' },
      };

      await controller.handleSystemLog(entry);

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

      await controller.handleSystemLog(entry);

      expect(repository.save).toHaveBeenCalledWith(entry);
    });
  });
});
