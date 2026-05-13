import type { LogMetadata } from './log-entry.interface.js';

export interface AuditEventPayload extends LogMetadata {
  readonly guildId: string | null;
  readonly actorUserId: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly occurredAt: Date;
  readonly metadata?: LogMetadata;
}
