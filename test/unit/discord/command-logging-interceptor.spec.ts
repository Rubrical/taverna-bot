import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import { CommandLoggingInterceptor } from '../../../src/discord/commands/interceptors/command-logging-interceptor.js';
import type { AuditEventPayload } from '../../../src/logger/domain/interfaces/audit-event-payload.js';
import type { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service.js';

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
  readonly guildId: string | null;
  readonly channelId: string;
  readonly isChatInputCommand: jest.Mock<boolean, []>;
}

interface CommandAuditEventPayload extends AuditEventPayload {
  readonly durationMs?: number;
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

function expectCommandAuditPayload(payload: CommandAuditEventPayload, guildId: string | null = 'guild-id'): void {
  expect(payload).toMatchObject({
    guildId,
    actorUserId: 'user-id',
    entityType: 'discord_command',
    entityId: 'ping',
    metadata: {
      command: 'ping',
      user: {
        id: 'user-id',
        tag: 'user#0001',
      },
      channelId: 'channel-id',
    },
  });
  expect(payload.occurredAt).toBeInstanceOf(Date);
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
    expect(logger.log.mock.calls[0]?.[0]).toBe('Discord command started: /ping');
    expect(logger.log.mock.calls[1]?.[0]).toBe('Discord command finished: /ping');

    const startedPayload = logger.log.mock.calls[0]?.[1] as CommandAuditEventPayload;
    const finishedPayload = logger.log.mock.calls[1]?.[1] as CommandAuditEventPayload;

    expectCommandAuditPayload(startedPayload);
    expectCommandAuditPayload(finishedPayload);
    expect(typeof finishedPayload.durationMs).toBe('number');
  });

  it('should log command failures', async () => {
    const interaction = createInteraction();
    const context = createExecutionContext([interaction]);
    const error = new Error('boom');

    await expect(lastValueFrom(interceptor.intercept(context, createFailingCallHandler(error)))).rejects.toThrow(error);

    expect(logger.error.mock.calls[0]?.[0]).toBe('Discord command failed: /ping');
    expect(logger.error.mock.calls[0]?.[1]).toBe(error);

    const failedPayload = logger.error.mock.calls[0]?.[2] as CommandAuditEventPayload;

    expectCommandAuditPayload(failedPayload);
    expect(typeof failedPayload.durationMs).toBe('number');
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

  it('should log interactions without guild id', async () => {
    const interaction = {
      ...createInteraction(),
      guildId: null,
    };
    const context = createExecutionContext([interaction]);

    await lastValueFrom(interceptor.intercept(context, createCallHandler('logged')));

    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();

    const startedPayload = logger.log.mock.calls[0]?.[1] as CommandAuditEventPayload;

    expectCommandAuditPayload(startedPayload, null);
  });
});
