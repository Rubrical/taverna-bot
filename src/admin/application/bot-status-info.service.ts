import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { TavernaLogger } from '../../logger/infrastructure/taverna-logger.service.js';
import type { BotStatus, DiscordBotStatus } from '../domain/bot-status-info.js';

@Injectable()
export class BotStatusInfoService {
  private readonly startupTime = new Date();
  private discordBotStatus?: DiscordBotStatus;
  private botInfo?: BotStatus;

  constructor(
    private readonly _logger: TavernaLogger,
    private readonly _configService: ConfigService,
  ) {
    _logger.setContext(BotStatusInfoService.name);
  }

  public async getBasicApplicationInfo(): Promise<BotStatus> {
    const info = await this.buildBasicApplicationInfo();
    this.botInfo = this.mergeDiscordBotStatus(info);

    return this.botInfo;
  }

  public async updateDiscordBotStatus(discordBotStatus: DiscordBotStatus): Promise<BotStatus> {
    this.discordBotStatus = discordBotStatus;

    const info = this.botInfo ?? (await this.buildBasicApplicationInfo());
    this.botInfo = this.mergeDiscordBotStatus(info);

    return this.botInfo;
  }

  private async buildBasicApplicationInfo(): Promise<BotStatus> {
    const commitHash = await this.getCommitHash();
    const botName = this._configService.getOrThrow<string>('APPLICATION_NAME');
    const ownerId = this._configService.getOrThrow<string>('OWNER_ID');
    const ownerName = this._configService.getOrThrow<string>('OWNER_NAME');
    const appVersion = this._configService.getOrThrow<string>('npm_package_version');
    const memoryUsage = this.formatBytesToMegaBytes(process.memoryUsage().rss);
    const memoryHeapUsage = this.formatBytesToMegaBytes(process.memoryUsage().heapUsed);
    const nodeVersion = process.version;
    const pid = process.pid;
    const ppid = process.ppid;

    return {
      lastCommitHash: commitHash,
      memoryUsage: memoryUsage,
      memoryHeapUsage: memoryHeapUsage,
      nodeVersion: nodeVersion,
      pid: pid,
      ppid: ppid,
      startedAt: this.startupTime,
      status: 'healthy',
      version: appVersion,
      name: botName,
      ownerId: ownerId,
      ownerName: ownerName,
      ...(this.discordBotStatus ? {discordBotStatus: this.discordBotStatus} : {}),
    };
  }

  private mergeDiscordBotStatus(botStatus: BotStatus): BotStatus {
    if (!this.discordBotStatus) {
      return botStatus;
    }

    return {
      ...botStatus,
      discordBotStatus: this.discordBotStatus,
    };
  }

  private async getCommitHash(): Promise<string | undefined> {
    const execFileAsync = promisify(execFile);
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD']);
      return stdout.trim();
    } catch (error) {
      this._logger.warn('Last commit hash was not available');
      this._logger.error('Exec error', error);

      return undefined;
    }
  }

  private formatBytesToMegaBytes(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }
}
