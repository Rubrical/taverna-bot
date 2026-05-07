import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { ChatInputCommandInteraction } from 'discord.js';
import { Observable, tap } from 'rxjs';

import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import type { LogMetadata } from '../../../logger/domain/interfaces/log-entry.interface.js';

interface CommandLogMetadata extends LogMetadata {
  readonly command: string;
  readonly user: {
    readonly id: string;
    readonly tag: string;
  };
  readonly guildId: string | null;
  readonly channelId: string | null;
  readonly durationMs?: number;
}

@Injectable()
export class CommandLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: TavernaLogger) {
    this.logger.setContext(CommandLoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const interaction = this.findChatInputCommandInteraction(context.getArgs());

    if (!interaction) {
      return next.handle();
    }

    const metadata = this.createMetadata(interaction);

    this.logger.log(`Discord command started: /${interaction.commandName}`, metadata);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`Discord command finished: /${interaction.commandName}`, {
            ...metadata,
            durationMs: Date.now() - startedAt,
          });
        },
        error: (error: unknown) => {
          this.logger.error(`Discord command failed: /${interaction.commandName}`, this.toError(error), {
            ...metadata,
            durationMs: Date.now() - startedAt,
          });
        },
      }),
    );
  }

  private findChatInputCommandInteraction(args: readonly unknown[]): ChatInputCommandInteraction | null {
    const flatArgs = args.flat(3);

    return (
      flatArgs.find((arg): arg is ChatInputCommandInteraction => {
        return this.isChatInputCommandInteraction(arg);
      }) ?? null
    );
  }

  private isChatInputCommandInteraction(value: unknown): value is ChatInputCommandInteraction {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (!('isChatInputCommand' in value) || typeof value.isChatInputCommand !== 'function') {
      return false;
    }

    return value.isChatInputCommand();
  }

  private createMetadata(interaction: ChatInputCommandInteraction): CommandLogMetadata {
    return {
      command: interaction.commandName,
      user: {
        id: interaction.user.id,
        tag: interaction.user.tag,
      },
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    };
  }

  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }
}
