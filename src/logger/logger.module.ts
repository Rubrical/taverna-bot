import { Global, Module } from '@nestjs/common';

import { LogPublisher } from './infrastructure/log-publisher.service';
import { TavernaLogger } from './infrastructure/taverna-logger.service';

@Global()
@Module({
  providers: [LogPublisher, TavernaLogger],
  exports: [TavernaLogger],
})
export class LoggerModule {}
