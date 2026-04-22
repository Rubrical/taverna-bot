import { Test, TestingModule } from '@nestjs/testing';

import { PingCommand } from '../../../../src/modules/discord/commands/ping.command';

describe('PingCommand', () => {
  let command: PingCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PingCommand],
    }).compile();

    command = module.get<PingCommand>(PingCommand);
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  describe('onPing()', () => {
    it('should reply with pong and latency', async () => {
      const mockInteraction = {
        createdTimestamp: Date.now() - 42,
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await command.onPing([mockInteraction as any]);

      expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('🏓 Pong!'),
        }),
      );
    });

    it('should include latency in the reply', async () => {
      const mockInteraction = {
        createdTimestamp: Date.now() - 100,
        reply: jest.fn().mockResolvedValue(undefined),
      };

      await command.onPing([mockInteraction as any]);

      const replyContent = mockInteraction.reply.mock.calls[0][0].content;
      expect(replyContent).toMatch(/Latency: \*\*\d+ms\*\*/);
    });
  });
});
