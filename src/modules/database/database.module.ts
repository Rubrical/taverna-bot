import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { LOGS_CONNECTION } from './database.constants.js';

@Module({
  imports: [
    // Primary connection — application data
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_APP_URI'),
      }),
    }),

    // Secondary connection — logs storage
    MongooseModule.forRootAsync({
      connectionName: LOGS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_LOGS_URI'),
      }),
    }),
  ],
})
export class DatabaseModule {}
