import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, EMPTY } from 'rxjs';

import { QUEUES } from '../../queues/queue-names';
import type { LogEntry } from '../domain/interfaces/log-entry.interface';

@Injectable()
export class LogPublisher {
  private readonly fallbackLogger = new ConsoleLogger(LogPublisher.name);

  constructor(@Inject(QUEUES.SYSTEM_LOGS) private readonly client: ClientProxy) {}

  publish(entry: LogEntry): void {
    try {
      this.client
        .emit<unknown, LogEntry>(QUEUES.SYSTEM_LOGS, entry)
        .pipe(
          catchError((error: unknown) => {
            this.reportFailure(error);
            return EMPTY;
          }),
        )
        .subscribe();
    } catch (error: unknown) {
      this.reportFailure(error);
    }
  }

  private reportFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.fallbackLogger.warn(`Failed to publish log entry to RabbitMQ: ${message}`);
  }
}
