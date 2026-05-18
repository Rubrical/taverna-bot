import { Test, type TestingModule } from '@nestjs/testing';
import type { ButtonContext, SlashCommandContext } from 'necord';

import { LogsQueryService, type LogsQueryResult } from '../../../src/admin/application/logs-query.service.js';
import { LogsCommand, type LogsCommandOptions } from '../../../src/discord/commands/admin/logs.command.js';
import type { SystemLogDocument } from '../../../src/logger/domain/schemas/system-log.schema.js';
import { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service.js';

interface ReplyPayload {
  readonly content?: string;
  readonly embeds?: readonly unknown[];
  readonly components?: readonly unknown[];
  readonly ephemeral?: boolean;
}

type MockInteraction = {
  readonly deferReply: jest.Mock<Promise<void>, [{ ephemeral: true }]>;
  readonly deferUpdate: jest.Mock<Promise<void>, []>;
  readonly editReply: jest.Mock<Promise<void>, [ReplyPayload]>;
  readonly reply: jest.Mock<Promise<void>, [ReplyPayload]>;
  readonly update: jest.Mock<Promise<void>, [ReplyPayload]>;
};

type LogsQueryServiceMock = {
  readonly findRecentLogs: jest.Mock<Promise<LogsQueryResult>, Parameters<LogsQueryService['findRecentLogs']>>;
};

function createContext(): {
  readonly context: SlashCommandContext;
  readonly interaction: MockInteraction;
} {
  const interaction: MockInteraction = {
    deferReply: jest.fn<Promise<void>, [{ ephemeral: true }]>().mockResolvedValue(undefined),
    deferUpdate: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    editReply: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
    reply: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
    update: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as SlashCommandContext[0]],
    interaction,
  };
}

function createButtonContext(): {
  readonly context: ButtonContext;
  readonly interaction: MockInteraction;
} {
  const interaction: MockInteraction = {
    deferReply: jest.fn<Promise<void>, [{ ephemeral: true }]>().mockResolvedValue(undefined),
    deferUpdate: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    editReply: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
    reply: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
    update: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as ButtonContext[0]],
    interaction,
  };
}

function createLogsQueryResult(overrides: Partial<LogsQueryResult> = {}): LogsQueryResult {
  return {
    logs: [createLog()],
    page: 1,
    pageSize: 10,
    total: 11,
    totalPages: 2,
    ...overrides,
  };
}

function createLog(overrides: Partial<SystemLogDocument> = {}): SystemLogDocument {
  return {
    level: 'log',
    message: 'Discord command started: /ping',
    context: 'CommandLoggingInterceptor',
    kind: 'audit',
    timestamp: '2026-05-14T12:00:00.000Z',
    metadata: {
      guildId: 'guild-123',
      actorUserId: 'actor-123',
    },
    ...overrides,
  } as unknown as SystemLogDocument;
}

describe('LogsCommand', () => {
  let command: LogsCommand;
  let logsQueryService: LogsQueryServiceMock;

  beforeEach(async () => {
    logsQueryService = {
      findRecentLogs: jest.fn<Promise<LogsQueryResult>, Parameters<LogsQueryService['findRecentLogs']>>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsCommand,
        {
          provide: LogsQueryService,
          useValue: logsQueryService,
        },
        {
          provide: TavernaLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    command = module.get<LogsCommand>(LogsCommand);
  });

  it('should reply with recent logs when no filter is provided', async () => {
    const { context, interaction } = createContext();
    logsQueryService.findRecentLogs.mockResolvedValue(createLogsQueryResult());

    await command.execute(context, {});

    expect(logsQueryService.findRecentLogs).toHaveBeenCalledWith({
      searchItem: undefined,
      param: undefined,
    });
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(interaction.editReply.mock.calls[0]?.[0].embeds?.[0])).toContain('Recent logs');
    expect(JSON.stringify(interaction.editReply.mock.calls[0]?.[0].embeds?.[0])).toContain('Page 1 of 2');
    expect(JSON.stringify(interaction.editReply.mock.calls[0]?.[0].components?.[0])).toContain('logs/next/2/none/none');
  });

  it('should pass the selected search item and param to the service', async () => {
    const { context, interaction } = createContext();
    const options: LogsCommandOptions = {
      searchItem: 'guild-id',
      param: ' guild-123 ',
    };
    logsQueryService.findRecentLogs.mockResolvedValue(createLogsQueryResult());

    await command.execute(context, options);

    expect(logsQueryService.findRecentLogs).toHaveBeenCalledWith({
      searchItem: 'guild-id',
      param: 'guild-123',
    });
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(interaction.editReply.mock.calls[0]?.[0].components?.[0])).toContain(
      'logs/next/2/guild-id/guild-123',
    );
  });

  it('should reject incomplete filters', async () => {
    const { context, interaction } = createContext();

    await command.execute(context, { searchItem: 'kind' });

    expect(logsQueryService.findRecentLogs).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Use `/logs` or `/logs search-item:<kind|guild-id|actor-user-id> param:<value>`.',
      ephemeral: true,
    });
  });

  it('should reject invalid kind values', async () => {
    const { context, interaction } = createContext();

    await command.execute(context, { searchItem: 'kind', param: 'invalid' });

    expect(logsQueryService.findRecentLogs).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Invalid kind. Use `system` or `audit`.',
      ephemeral: true,
    });
  });

  it('should reply with no results message when no logs are found', async () => {
    const { context, interaction } = createContext();
    logsQueryService.findRecentLogs.mockResolvedValue(createLogsQueryResult({ logs: [], total: 0, totalPages: 1 }));

    await command.execute(context, {});

    expect(JSON.stringify(interaction.editReply.mock.calls[0]?.[0].embeds?.[0])).toContain('No logs found.');
  });

  it('should update the message with the next page when next button is clicked', async () => {
    const { context, interaction } = createButtonContext();
    logsQueryService.findRecentLogs.mockResolvedValue(createLogsQueryResult({ page: 2, totalPages: 3 }));

    await command.onPageButton(context, 'next', '2', 'guild-id', 'guild-123');

    expect(logsQueryService.findRecentLogs).toHaveBeenCalledWith({
      searchItem: 'guild-id',
      param: 'guild-123',
      page: 2,
    });
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(interaction.editReply.mock.calls[0]?.[0].embeds?.[0])).toContain('Page 2 of 3');
  });

  it('should update the message with the previous page when previous button is clicked', async () => {
    const { context, interaction } = createButtonContext();
    logsQueryService.findRecentLogs.mockResolvedValue(createLogsQueryResult({ page: 1, totalPages: 2 }));

    await command.onPageButton(context, 'previous', '1', 'none', 'none');

    expect(logsQueryService.findRecentLogs).toHaveBeenCalledWith({
      searchItem: undefined,
      param: undefined,
      page: 1,
    });
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
  });

  it('should disable previous and next buttons on a single page', async () => {
    const { context, interaction } = createContext();
    logsQueryService.findRecentLogs.mockResolvedValue(createLogsQueryResult({ page: 1, totalPages: 1, total: 1 }));

    await command.execute(context, {});

    const componentsJson = JSON.stringify(interaction.editReply.mock.calls[0]?.[0].components?.[0]);

    expect(componentsJson).toContain('"disabled":true');
    expect(componentsJson?.match(/"disabled":true/g)).toHaveLength(2);
  });
});
