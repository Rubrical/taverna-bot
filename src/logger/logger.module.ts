import { Module } from '@nestjs/common';

import { LogPublisher } from './infrastructure/log-publisher.service';
import { TavernaLogger } from './infrastructure/taverna-logger.service';

@Module({
  providers: [LogPublisher, TavernaLogger],
  exports: [TavernaLogger],
})
export class LoggerModule {}
