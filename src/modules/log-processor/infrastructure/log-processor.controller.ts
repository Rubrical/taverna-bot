import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SYSTEM_LOGS_QUEUE } from '../../../common/constants/queue-names.js';
import type { LogEntry } from '../../logger/domain/interfaces/log-entry.interface.js';
import { LogProcessorRepository } from './log-processor.repository.js';

@Controller()
export class LogProcessorController {
  constructor(private readonly repository: LogProcessorRepository) {}

  @EventPattern(SYSTEM_LOGS_QUEUE)
  async handleSystemLog(@Payload() entry: LogEntry): Promise<void> {
    await this.repository.save(entry);
  }
}
