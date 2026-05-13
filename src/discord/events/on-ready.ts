import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ActivityType } from 'discord.js';
import { Context, Once, type ContextOf } from 'necord';

import { BotStatusInfoService } from '../../admin/application/bot-status-info.service.js';
import { TavernaLogger } from '../../logger/infrastructure/taverna-logger.service.js';
import { cacheKeys } from '../../infrastructure/cache/cache-keys.js';

@Injectable()
export class OnReady {
  constructor(
    private readonly _logger: TavernaLogger,
    private readonly botStatusService: BotStatusInfoService,
    @Inject(CACHE_MANAGER) private readonly _cache: Cache,
  ) {
    _logger.setContext(OnReady.name);
  }

  @Once('clientReady')
  public async onReady(@Context() [client]: ContextOf<'clientReady'>) {
    if (!client.isReady()) {
      return;
    }

    const clientStatus = 'online';
    const readyAt = client.readyAt;
    const botName = client.user.username;
    const botId = client.user.id;
    const guilds = client.guilds.cache.map((guild) => guild.name);

    client.user.setStatus(clientStatus);
    client.user.setPresence({
      activities: [{ type: ActivityType.Listening, name: 'Suas sessões de RPG' }],
    });

    const botStatus = await this.botStatusService.updateDiscordBotStatus({
      clientStatus: clientStatus,
      clientReadyAt: readyAt,
      discordId: botId,
      discordName: botName,
      guilds: guilds,
    });

    this._logger.log(`Bot is up on ${readyAt.toISOString()}! Name: ${botName} Id: ${botId}`);
    await this._cache.set(cacheKeys.bot.status(), botStatus, 0);
  }
}
