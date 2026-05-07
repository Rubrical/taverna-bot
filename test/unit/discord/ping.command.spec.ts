import { Test, TestingModule } from '@nestjs/testing';
import type { SlashCommandContext } from 'necord';

import { PingCommand } from '../../../src/discord/commands/ping.command';
import { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service';

interface ReplyPayload {
  readonly content: string;
}

type MockInteraction = {
  readonly createdTimestamp: number;
  readonly reply: jest.Mock<Promise<void>, [ReplyPayload]>;
};

function createReplyMock(): MockInteraction['reply'] {
  return jest.fn<Promise<void>, [ReplyPayload]>().mockResolvedValue(undefined);
}

function createContext(latency: number): {
  readonly context: SlashCommandContext;
  readonly interaction: MockInteraction;
} {
  const interaction: MockInteraction = {
    createdTimestamp: Date.now() - latency,
    reply: createReplyMock(),
  };

  return {
    context: [interaction as unknown as SlashCommandContext[0]],
    interaction,
  };
}

describe('PingCommand', () => {
  let command: PingCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PingCommand,
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

    command = module.get<PingCommand>(PingCommand);
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  describe('onPing()', () => {
    it('should reply with pong and latency', async () => {
      const { context, interaction } = createContext(42);

      await command.onPing(context);

      expect(interaction.reply).toHaveBeenCalledTimes(1);

      const replyCall = interaction.reply.mock.calls[0];
      expect(replyCall).toBeDefined();

      if (!replyCall) {
        return;
      }

      const [replyPayload] = replyCall;
      expect(replyPayload.content).toContain('🏓 Pong!');
    });

    it('should include latency in the reply', async () => {
      const { context, interaction } = createContext(100);

      await command.onPing(context);

      const replyCall = interaction.reply.mock.calls[0];
      expect(replyCall).toBeDefined();

      if (!replyCall) {
        return;
      }

      const [replyPayload] = replyCall;
      const replyContent = replyPayload.content;
      expect(replyContent).toMatch(/Latency: \*\*\d+ms\*\*/);
    });
  });
});
