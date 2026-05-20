import type { LogLevel } from '../../../common/types/index.js';

export type LogKind = 'system' | 'audit';

export interface LogMetadata {
  readonly kind?: LogKind;
  readonly [key: string]: unknown;
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: string;
  readonly kind?: LogKind;
  readonly timestamp: string;
  readonly metadata?: LogMetadata;
}
