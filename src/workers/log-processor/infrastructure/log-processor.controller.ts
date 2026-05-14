import { ConsoleLogger, Controller, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Channel, Message } from 'amqplib';

import type { LogEntry } from '../../../logger/domain/interfaces/log-entry.interface.js';
import {
  SYSTEM_LOG_REPOSITORY,
  type SystemLogRepositoryPort,
} from '../../../logger/domain/interfaces/system-log-repository.interface.js';
import { QUEUES } from '../../../infrastructure/queues/queue-names.js';

@Controller()
export class LogProcessorController {
  // Doing this to avoid infinite logging
  private readonly _fallbackLogger: ConsoleLogger;

  constructor(
    @Inject(SYSTEM_LOG_REPOSITORY)
    private readonly repository: SystemLogRepositoryPort,
    config: ConfigService,
  ) {
    const appContext = config.get<string>('APPLICATION_NAME', 'Taverna Bot');
    this._fallbackLogger = new ConsoleLogger(LogProcessorController.name, { prefix: appContext });
  }

  @EventPattern(QUEUES.SYSTEM_LOGS)
  async handleSystemLog(@Payload() entry: LogEntry, @Ctx() context: RmqContext): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as Message;

    try {
      this._fallbackLogger.log('Saving log entry');
      await this.repository.save(entry);

      channel.ack(message);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this._fallbackLogger.warn(`Failed to save log entry: ${reason}`);

      channel.nack(message, false, true);
    }
  }
}
