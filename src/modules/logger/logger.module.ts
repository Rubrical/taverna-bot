import { Global, Module } from '@nestjs/common';

import { CustomLoggerService } from './infrastructure/logger.service.js';

@Global()
@Module({
  providers: [CustomLoggerService],
  exports: [CustomLoggerService],
})
export class LoggerModule {}
