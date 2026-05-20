import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { LogLevel } from '../../common/types/index.js';
import type { LogKind, LogMetadata } from '../domain/interfaces/log-entry.interface.js';
import { LogPublisher } from './log-publisher.service.js';

@Injectable({ scope: Scope.TRANSIENT })
export class TavernaLogger extends ConsoleLogger {
  constructor(
    private readonly publisher: LogPublisher,
    private readonly config: ConfigService,
  ) {
    const appContext = config.get<string>('APPLICATION_NAME', 'Taverna Bot');
    super({ prefix: appContext });
  }

  override log(message: unknown, contextOrMetadata?: string | LogMetadata): void {
    const { context, metadata } = this.resolveContextAndMetadata(contextOrMetadata);

    super.log(message, context);
    this.publish('log', message, context, metadata);
  }

  override warn(message: unknown, contextOrMetadata?: string | LogMetadata): void {
    const { context, metadata } = this.resolveContextAndMetadata(contextOrMetadata);

    super.warn(message, context);
    this.publish('warn', message, context, metadata);
  }

  override debug(message: unknown, contextOrMetadata?: string | LogMetadata): void {
    const { context, metadata } = this.resolveContextAndMetadata(contextOrMetadata);

    super.debug(message, context);
    this.publish('debug', message, context, metadata);
  }

  override verbose(message: unknown, contextOrMetadata?: string | LogMetadata): void {
    const { context, metadata } = this.resolveContextAndMetadata(contextOrMetadata);

    super.verbose(message, context);
    this.publish('verbose', message, context, metadata);
  }

  override error(
    message: unknown,
    errorOrContextOrMetadata?: Error | string | LogMetadata,
    contextOrMetadata?: string | LogMetadata,
  ): void {
    const { context, metadata, stack } = this.resolveErrorParams(errorOrContextOrMetadata, contextOrMetadata);

    super.error(message, stack, context);
    this.publish('error', message, context, metadata);
  }

  private publish(level: LogLevel, message: unknown, context?: string, metadata?: LogMetadata): void {
    const normalizedLogMetadata = this.extractLogMetadata(metadata);

    this.publisher.publish({
      level,
      message: this.formatMessageForTransport(message),
      context,
      kind: normalizedLogMetadata.kind,
      timestamp: new Date().toISOString(),
      metadata: normalizedLogMetadata.metadata,
    });
  }

  private extractLogMetadata(metadata?: LogMetadata): {
    readonly kind?: LogKind;
    readonly metadata?: LogMetadata;
  } {
    if (!metadata) {
      return {};
    }

    const { kind, ...rest } = metadata;
    const normalizedMetadata = Object.keys(rest).length > 0 ? rest : undefined;

    if (this.isLogKind(kind)) {
      return { kind, metadata: normalizedMetadata };
    }

    return { metadata: normalizedMetadata };
  }

  private resolveContextAndMetadata(value?: string | LogMetadata): {
    readonly context?: string;
    readonly metadata?: LogMetadata;
  } {
    if (!value) {
      return { context: this.context };
    }

    if (typeof value === 'string') {
      return { context: value };
    }

    return {
      context: this.context,
      metadata: value,
    };
  }

  private resolveErrorParams(
    errorOrContextOrMetadata?: Error | string | LogMetadata,
    contextOrMetadata?: string | LogMetadata,
  ): {
    readonly context?: string;
    readonly metadata?: LogMetadata;
    readonly stack?: string;
  } {
    const metadata = this.isMetadata(contextOrMetadata) ? contextOrMetadata : undefined;
    const context = typeof contextOrMetadata === 'string' ? contextOrMetadata : this.context;

    if (errorOrContextOrMetadata instanceof Error) {
      return {
        context,
        stack: errorOrContextOrMetadata.stack,
        metadata: {
          ...metadata,
          error: {
            name: errorOrContextOrMetadata.name,
            message: errorOrContextOrMetadata.message,
            stack: errorOrContextOrMetadata.stack,
            cause: errorOrContextOrMetadata.cause,
          },
        },
      };
    }

    if (typeof errorOrContextOrMetadata === 'string') {
      return {
        context: typeof contextOrMetadata === 'string' ? contextOrMetadata : this.context,
        stack: errorOrContextOrMetadata,
        metadata,
      };
    }

    return {
      context,
      metadata: {
        ...errorOrContextOrMetadata,
        ...metadata,
      },
    };
  }

  private isMetadata(value: unknown): value is LogMetadata {
    return !!value && typeof value === 'object' && !(value instanceof Error);
  }

  private isLogKind(value: unknown): value is LogKind {
    return value === 'system' || value === 'audit';
  }

  private formatMessageForTransport(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
