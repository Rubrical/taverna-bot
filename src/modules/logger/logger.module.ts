import { Global, Module } from '@nestjs/common';

import { LogPublisher } from './infrastructure/log-publisher.service.js';
import { TavernaLogger } from './infrastructure/logger.service.js';

@Global()
@Module({
  providers: [LogPublisher, TavernaLogger],
  exports: [TavernaLogger],
})
export class LoggerModule {}
