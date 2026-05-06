import { Injectable } from '@nestjs/common';
import { ActivityType } from 'discord.js';
import { Context, Once, type ContextOf } from 'necord';

import { TavernaLogger } from '../../logger/infrastructure/taverna-logger.service.js';

@Injectable()
export class OnReady {
  constructor(private readonly _logger: TavernaLogger) {
    _logger.setContext(OnReady.name);
  }

  @Once('clientReady')
  public onReady(@Context() [client]: ContextOf<'clientReady'>) {
    if (client.isReady()) {
      const readytime = client.readyTimestamp;
      const botName = client.user.username;
      const botId = client.user.id;

      client.user.setStatus('online');
      client.user.setPresence({
        activities: [{ type: ActivityType.Listening, name: 'Suas sessões de RPG' }],
      });

      this._logger.log(`Bot is up on ${readytime}! Name: ${botName} Id: ${botId}`);
    }
  }
}
