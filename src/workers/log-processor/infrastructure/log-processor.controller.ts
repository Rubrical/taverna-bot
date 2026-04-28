import { ConsoleLogger, Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import { QUEUES } from '../../../queues/queue-names.js';
import type { LogEntry } from '../../../logger/domain/interfaces/log-entry.interface.js';
import { LogProcessorRepository } from './log-processor.repository.js';
import { Channel, Message } from 'amqplib';

@Controller()
export class LogProcessorController {
  // Doing this to avoid infinite logging
  private readonly _fallbackLogger = new ConsoleLogger(LogProcessorController.name);
  constructor(private readonly repository: LogProcessorRepository) {}

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
