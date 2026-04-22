import type { LogLevel } from '../../../../common/types/index.js';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}
