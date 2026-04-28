import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './infrastructure/database/database.module.js';
import { QueueModule } from './queues/queue.module.js';
import { AppCacheModule } from './infrastructure/cache/cache.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { DiscordModule } from './discord/discord.module.js';
import { WorkersModule } from './workers/workers.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    QueueModule,
    AppCacheModule,
    LoggerModule,
    DiscordModule,
    WorkersModule,
  ],
})
export class AppModule {}
