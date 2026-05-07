import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import { CommandLoggingInterceptor } from '../../../src/discord/commands/interceptors/command-logging-interceptor';
import type { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service';

interface LoggerMock {
  readonly setContext: jest.Mock<void, [string]>;
  readonly log: jest.Mock<void, [unknown, unknown?]>;
  readonly error: jest.Mock<void, [unknown, Error, unknown?]>;
}

interface InteractionMock {
  readonly commandName: string;
  readonly user: {
    readonly id: string;
    readonly tag: string;
  };
  readonly guildId: string;
  readonly channelId: string;
  readonly isChatInputCommand: jest.Mock<boolean, []>;
}

function createLoggerMock(): LoggerMock {
  return {
    setContext: jest.fn<void, [string]>(),
    log: jest.fn<void, [unknown, unknown?]>(),
    error: jest.fn<void, [unknown, Error, unknown?]>(),
  };
}

function createExecutionContext(args: readonly unknown[]): ExecutionContext {
  return {
    getArgs: () => args,
  } as ExecutionContext;
}

function createCallHandler(value: unknown): CallHandler {
  return {
    handle: () => of(value),
  };
}

function createFailingCallHandler(error: Error): CallHandler {
  return {
    handle: () => throwError(() => error),
  };
}

function createInteraction(): InteractionMock {
  return {
    commandName: 'ping',
    user: {
      id: 'user-id',
      tag: 'user#0001',
    },
    guildId: 'guild-id',
    channelId: 'channel-id',
    isChatInputCommand: jest.fn<boolean, []>().mockReturnValue(true),
  };
}

describe('CommandLoggingInterceptor', () => {
  let logger: LoggerMock;
  let interceptor: CommandLoggingInterceptor;

  beforeEach(() => {
    logger = createLoggerMock();
    interceptor = new CommandLoggingInterceptor(logger as unknown as TavernaLogger);
  });

  it('should set the logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith(CommandLoggingInterceptor.name);
  });

  it('should log command start and finish', async () => {
    const interaction = createInteraction();
    const context = createExecutionContext([[interaction]]);

    await lastValueFrom(interceptor.intercept(context, createCallHandler('pong')));

    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenNthCalledWith(1, 'Discord command started: /ping', {
      command: 'ping',
      user: {
        id: 'user-id',
        tag: 'user#0001',
      },
      guildId: 'guild-id',
      channelId: 'channel-id',
    });
    expect(logger.log).toHaveBeenNthCalledWith(2, 'Discord command finished: /ping', {
      command: 'ping',
      user: {
        id: 'user-id',
        tag: 'user#0001',
      },
      guildId: 'guild-id',
      channelId: 'channel-id',
      durationMs: expect.any(Number),
    });
  });

  it('should log command failures', async () => {
    const interaction = createInteraction();
    const context = createExecutionContext([interaction]);
    const error = new Error('boom');

    await expect(lastValueFrom(interceptor.intercept(context, createFailingCallHandler(error)))).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith('Discord command failed: /ping', error, {
      command: 'ping',
      user: {
        id: 'user-id',
        tag: 'user#0001',
      },
      guildId: 'guild-id',
      channelId: 'channel-id',
      durationMs: expect.any(Number),
    });
  });

  it('should ignore non chat input interactions', async () => {
    const interaction = {
      ...createInteraction(),
      isChatInputCommand: jest.fn<boolean, []>().mockReturnValue(false),
    };
    const context = createExecutionContext([interaction]);

    await lastValueFrom(interceptor.intercept(context, createCallHandler('ignored')));

    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
