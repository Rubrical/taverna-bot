import type { LogLevel } from '../../../common/types';

export interface LogMetadata {
  readonly [key: string]: unknown;
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: string;
  readonly timestamp: string;
  readonly metadata?: LogMetadata;
}
