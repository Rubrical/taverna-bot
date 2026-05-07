import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, EMPTY } from 'rxjs';

import { QUEUES } from '../../infrastructure/queues/queue-names.js';
import type { LogEntry } from '../domain/interfaces/log-entry.interface.js';

@Injectable()
export class LogPublisher {
  // Doing this to avoid infinite logging
  private readonly _fallbackLogger: ConsoleLogger;

  constructor(
    @Inject(QUEUES.SYSTEM_LOGS) private readonly client: ClientProxy,
    config: ConfigService,
  ) {
    const appContext = config.get<string>('APPLICATION_NAME', 'Taverna Bot');
    this._fallbackLogger = new ConsoleLogger(LogPublisher.name, { prefix: appContext });
  }

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
    this._fallbackLogger.warn(`Failed to publish log entry to RabbitMQ: ${message}`);
  }
}
