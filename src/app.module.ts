import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module.js';
import { QueueModule } from './queue/queue.module.js';
import { AppCacheModule } from './cache/cache.module.js';
import { LoggerModule } from './modules/logger/logger.module.js';
import { LogProcessorModule } from './modules/log-processor/log-processor.module.js';
import { DiscordModule } from './discord/discord.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    QueueModule,
    AppCacheModule,
    LoggerModule,
    LogProcessorModule,
    DiscordModule,
  ],
})
export class AppModule {}
