import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { ChatInputCommandInteraction } from 'discord.js';
import { Observable, tap } from 'rxjs';

import type { AuditEventPayload } from '../../../logger/domain/interfaces/audit-event-payload.js';
import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';

interface ChatInputCommandInteractionCandidate {
  readonly isChatInputCommand: () => boolean;
}

interface CommandAuditEventPayload extends AuditEventPayload {
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

    const payload = this.createAuditEventPayload(interaction);

    this.logger.log(`Discord command started: /${interaction.commandName}`, payload);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`Discord command finished: /${interaction.commandName}`, {
            ...payload,
            durationMs: Date.now() - startedAt,
          });
        },
        error: (error: unknown) => {
          this.logger.error(`Discord command failed: /${interaction.commandName}`, this.toError(error), {
            ...payload,
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
    if (!this.hasChatInputCommandPredicate(value)) {
      return false;
    }

    return value.isChatInputCommand();
  }

  private hasChatInputCommandPredicate(value: unknown): value is ChatInputCommandInteractionCandidate {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as { readonly isChatInputCommand?: unknown };

    return typeof candidate.isChatInputCommand === 'function';
  }

  private createAuditEventPayload(interaction: ChatInputCommandInteraction): CommandAuditEventPayload {
    return {
      guildId: interaction.guildId,
      actorUserId: interaction.user.id,
      entityType: 'discord_command',
      entityId: interaction.commandName,
      occurredAt: new Date(),
      metadata: {
        command: interaction.commandName,
        user: {
          id: interaction.user.id,
          tag: interaction.user.tag,
        },
        channelId: interaction.channelId,
      },
    };
  }

  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }
}
