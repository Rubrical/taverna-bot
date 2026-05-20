import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { MongoTransactionProvider } from './mongo-transaction-provider.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_APP_URI'),
      }),
    }),
  ],
  providers: [MongoTransactionProvider],
  exports: [MongoTransactionProvider],
})
export class DatabaseModule {}
