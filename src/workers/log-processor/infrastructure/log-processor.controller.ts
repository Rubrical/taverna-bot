import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { QUEUES } from '../../../queues/queue-names';
import type { LogEntry } from '../../../logger/domain/interfaces/log-entry.interface';
import { LogProcessorRepository } from './log-processor.repository';

@Controller()
export class LogProcessorController {
  constructor(private readonly repository: LogProcessorRepository) {}

  @EventPattern(QUEUES.SYSTEM_LOGS)
  async handleSystemLog(@Payload() entry: LogEntry): Promise<void> {
    await this.repository.save(entry);
  }
}
