export interface BotInfo {
  readonly name: string;
  readonly version: string;
  readonly latency?: number;
  readonly runningFor?: string;
  readonly ownerId: string;
  readonly ownerName: string;
}

export interface BotStatus extends BotInfo {
  readonly lastCommitHash?: string;
  readonly nodeVersion: string;
  readonly startedAt: Date;
  readonly pid: number;
  readonly ppid: number;
  readonly memoryUsage: number;
  readonly memoryHeapUsage: number;
  readonly discordBotStatus?: DiscordBotStatus;
  readonly externalServicesStatus?: readonly ExternalServiceStatus[];
  readonly status: HealthStatus;
}

export interface DiscordBotStatus {
  readonly clientStatus: string;
  readonly clientReadyAt: Date | null;
  readonly discordId: string;
  readonly discordName: string;
  readonly guilds: string[];
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export interface ExternalServiceStatus {
  readonly name: string;
  readonly version: string;
  readonly status: HealthStatus;
  readonly hasProblems: boolean;
  readonly problems: readonly ExternalServiceProblem[];
}

export interface ExternalServiceProblem {
  readonly code: string;
  readonly message: string;
}
