import { Test, type TestingModule } from '@nestjs/testing';
import type { SlashCommandContext } from 'necord';

import { BotStatusInfoService } from '../../../src/admin/application/bot-status-info.service';
import type { BotStatus } from '../../../src/admin/domain/bot-status-info';
import { BotStatusCommand } from '../../../src/discord/commands/bot/bot-status.command';
import { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service';

interface ReplyPayload {
  readonly embeds: readonly unknown[];
}

type MockInteraction = {
  readonly reply: jest.Mock<Promise<void>, [ReplyPayload]>;
};

type BotStatusInfoServiceMock = {
  readonly getCachedBotStatusOrElseBasicApplicationInfo: jest.Mock<Promise<BotStatus>, []>;
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
      clientReadyAt: new Date('2026-05-12T10:01:00.000Z'),
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
    reply: jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined),
  };

  return {
    context: [interaction as unknown as SlashCommandContext[0]],
    interaction,
  };
}

describe('BotStatusCommand', () => {
  let command: BotStatusCommand;
  let botStatusInfoService: BotStatusInfoServiceMock;

  beforeEach(async () => {
    botStatusInfoService = {
      getCachedBotStatusOrElseBasicApplicationInfo: jest.fn<Promise<BotStatus>, []>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotStatusCommand,
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

    command = module.get<BotStatusCommand>(BotStatusCommand);
  });

  it('should reply with cached complete bot status when Redis has data', async () => {
    const botStatus = createBotStatus();
    botStatusInfoService.getCachedBotStatusOrElseBasicApplicationInfo.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    expect(botStatusInfoService.getCachedBotStatusOrElseBasicApplicationInfo).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it('should reply with complete bot status returned by the status service', async () => {
    const botStatus = createBotStatus({ discordBotStatus: undefined });
    botStatusInfoService.getCachedBotStatusOrElseBasicApplicationInfo.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    expect(botStatusInfoService.getCachedBotStatusOrElseBasicApplicationInfo).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it('should format valid dates as YYYY/MM/DD', async () => {
    const botStatus = createBotStatus();
    botStatusInfoService.getCachedBotStatusOrElseBasicApplicationInfo.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    const replyCall = interaction.reply.mock.calls[0];
    expect(replyCall).toBeDefined();

    if (!replyCall) {
      return;
    }

    const [replyPayload] = replyCall;
    const embedJson = JSON.stringify(replyPayload.embeds[0]);

    expect(embedJson).toContain('2026/05/11');
    expect(embedJson).toContain('2026/05/12');
  });

  it('should show unavailable when dates are invalid', async () => {
    const botStatus = createBotStatus({
      startedAt: 'invalid-date' as unknown as Date,
      discordBotStatus: {
        clientStatus: 'online',
        clientReadyAt: 'invalid-date' as unknown as Date,
        discordId: 'bot-id',
        discordName: 'Taverna',
        guilds: ['Guild One'],
      },
    });
    botStatusInfoService.getCachedBotStatusOrElseBasicApplicationInfo.mockResolvedValue(botStatus);
    const { context, interaction } = createContext();

    await command.execute(context);

    const replyCall = interaction.reply.mock.calls[0];
    expect(replyCall).toBeDefined();

    if (!replyCall) {
      return;
    }

    const [replyPayload] = replyCall;
    const embedJson = JSON.stringify(replyPayload.embeds[0]);

    expect(embedJson).toContain('Unavailable');
  });
});
