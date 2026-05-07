import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

import { QUEUES } from '../../../src/infrastructure/queues/queue-names';
import type { LogEntry } from '../../../src/logger/domain/interfaces/log-entry.interface';
import { LogPublisher } from '../../../src/logger/infrastructure/log-publisher.service';

type ClientProxyMock = {
  emit: jest.Mock;
};

type ConfigServiceMock = {
  get: jest.Mock<string, [string, string]>;
};

function createLogEntry(): LogEntry {
  return {
    level: 'log',
    message: 'Test message',
    context: 'TestContext',
    timestamp: new Date().toISOString(),
  };
}

describe('LogPublisher', () => {
  let publisher: LogPublisher;
  let client: ClientProxyMock;
  let config: ConfigServiceMock;
  let consoleWarnSpy: jest.SpiedFunction<typeof ConsoleLogger.prototype.warn>;

  beforeEach(async () => {
    client = {
      emit: jest.fn().mockReturnValue(of(undefined)),
    };
    config = {
      get: jest.fn<string, [string, string]>().mockReturnValue('Taverna Bot'),
    };

    consoleWarnSpy = jest.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogPublisher,
        {
          provide: QUEUES.SYSTEM_LOGS,
          useValue: client as Partial<ClientProxy>,
        },
        {
          provide: ConfigService,
          useValue: config,
        },
      ],
    }).compile();

    publisher = module.get<LogPublisher>(LogPublisher);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should emit the log entry to RabbitMQ', () => {
    const entry = createLogEntry();

    publisher.publish(entry);

    expect(config.get).toHaveBeenCalledWith('APPLICATION_NAME', 'Taverna Bot');
    expect(client.emit).toHaveBeenCalledWith(QUEUES.SYSTEM_LOGS, entry);
  });

  it('should not throw when RabbitMQ emit throws synchronously', () => {
    client.emit.mockImplementation(() => {
      throw new Error('connection failed');
    });

    expect(() => publisher.publish(createLogEntry())).not.toThrow();
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to publish log entry to RabbitMQ: connection failed');
  });

  it('should not throw when RabbitMQ emit fails asynchronously', () => {
    client.emit.mockReturnValue(throwError(() => new Error('channel closed')));

    expect(() => publisher.publish(createLogEntry())).not.toThrow();
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to publish log entry to RabbitMQ: channel closed');
  });
});
