import { Test, type TestingModule } from '@nestjs/testing';
import type { SlashCommandContext } from 'necord';

import { BotStatusInfoService } from '../../../src/admin/application/bot-status-info.service';
import type { BotStatus } from '../../../src/admin/domain/bot-status-info';
import { BotInfoCommand } from '../../../src/discord/commands/bot-info.command';
import { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service';

interface ReplyPayload {
  readonly embeds: readonly unknown[];
}

type MockInteraction = {
  readonly createdTimestamp: number;
  readonly reply: jest.Mock<Promise<void>, [ReplyPayload]>;
};

type BotStatusInfoServiceMock = {
  readonly getCachedBotStatus: jest.Mock<Promise<BotStatus>, []>;
};

function createBotStatus(overrides: Partial<BotStatus> = {}): BotStatus {
  return {
    lastCommitHash: 'abc1234',
    memoryUsage: 120.5,
    memoryHeapUsage: 50.25,
    nodeVersion: 'v24.0.0',
    pid: 123,
    ppid: 1,
    startedAt: new Date('2026-05-11T10:00:00.000Z'),
    status: 'healthy',
    version: '0.0.1',
    name: 'Taverna Bot',
    ownerId: 'owner-id',
    ownerName: 'Owner',
    discordBotStatus: {
      clientStatus: 'online',
      clientReadyAt: new Date('2026-05-11T10:01:00.000Z'),
      discordId: 'bot-id',
      discordName: 'Taverna',
      guilds: ['Guild One'],
    },
    ...overrides,
  };
}

function createContext(): {
  readonly context: SlashCommandContext;
  readonly interaction: MockInteraction;
} {
  const interaction: MockInteraction = {
    createdTimestamp: Date.now() - 25,
    reply: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as SlashCommandContext[0]],
    interaction,
  };
}

describe('BotInfoCommand', () => {
  let command: BotInfoCommand;
  let botStatusInfoService: BotStatusInfoServiceMock;

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    botStatusInfoService = {
      getCachedBotStatus: jest.fn<Promise<BotStatus>, []>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotInfoCommand,
        {
          provide: BotStatusInfoService,
          useValue: botStatusInfoService,
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

    command = module.get<BotInfoCommand>(BotInfoCommand);
  });

  it('should reply with cached bot info when Redis has data', async () => {
    const botStatus = createBotStatus();
    botStatusInfoService.getCachedBotStatus.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    expect(botStatusInfoService.getCachedBotStatus).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it('should only include public bot info fields in the reply', async () => {
    const botStatus = createBotStatus();
    botStatusInfoService.getCachedBotStatus.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    const replyCall = interaction.reply.mock.calls[0];
    expect(replyCall).toBeDefined();

    if (!replyCall) {
      return;
    }

    const [replyPayload] = replyCall;
    const [embed] = replyPayload.embeds;
    const embedJson = JSON.stringify(embed);

    expect(embedJson).toContain('Taverna Bot info');
    expect(embedJson).toContain('Version');
    expect(embedJson).toContain('Latency');
    expect(embedJson).toContain('Running for');
    expect(embedJson).toContain('Owner');
    expect(embedJson).not.toContain('Memory RSS');
    expect(embedJson).not.toContain('Discord status');
  });

  it('should include how long the application has been running', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-12T11:01:00.000Z'));

    const botStatus = createBotStatus({
      startedAt: new Date('2026-05-11T10:00:00.000Z'),
    });
    botStatusInfoService.getCachedBotStatus.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    const replyCall = interaction.reply.mock.calls[0];
    expect(replyCall).toBeDefined();

    if (!replyCall) {
      return;
    }

    const [replyPayload] = replyCall;
    const embedJson = JSON.stringify(replyPayload.embeds[0]);

    expect(embedJson).toContain('1d 1h 1m');
  });

  it('should reply with bot info returned by the status service', async () => {
    const botStatus = createBotStatus({ discordBotStatus: undefined });
    botStatusInfoService.getCachedBotStatus.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    expect(botStatusInfoService.getCachedBotStatus).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });
});
