import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { RABBITMQ_SERVICE } from '../../../common/constants/injection-tokens.js';
import { SYSTEM_LOGS_QUEUE } from '../../../common/constants/queue-names.js';
import type { LogLevel } from '../../../common/types';
import type { LogEntry } from '../domain/interfaces/log-entry.interface.js';

@Injectable()
export class CustomLoggerService implements LoggerService {
  constructor(
    @Inject(RABBITMQ_SERVICE)
    private readonly rmqClient: ClientProxy,
  ) {}

  log(message: string, context?: string): void {
    this.printAndShip('log', message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.printAndShip('error', message, context, { trace });
  }

  warn(message: string, context?: string): void {
    this.printAndShip('warn', message, context);
  }

  debug(message: string, context?: string): void {
    this.printAndShip('debug', message, context);
  }

  verbose(message: string, context?: string): void {
    this.printAndShip('verbose', message, context);
  }

  private printAndShip(level: LogLevel, message: string, context?: string, metadata?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const prefix = context ? `[${context}]` : '';
    const tag = level.toUpperCase().padEnd(7);

    // Console output
    const formatted = `${timestamp} ${tag} ${prefix} ${message}`;
    this.writeToConsole(level, formatted);

    // Ship to RabbitMQ (fire-and-forget)
    const entry: LogEntry = { level, message, context, timestamp, metadata };
    this.rmqClient.emit(SYSTEM_LOGS_QUEUE, entry);
  }

  private writeToConsole(level: LogLevel, formatted: string): void {
    const writers: Record<LogLevel, (msg: string) => void> = {
      log: (msg) => console.log(`\x1b[32m${msg}\x1b[0m`),
      error: (msg) => console.error(`\x1b[31m${msg}\x1b[0m`),
      warn: (msg) => console.warn(`\x1b[33m${msg}\x1b[0m`),
      debug: (msg) => console.debug(`\x1b[36m${msg}\x1b[0m`),
      verbose: (msg) => console.log(`\x1b[35m${msg}\x1b[0m`),
    };

    writers[level](formatted);
  }
}
