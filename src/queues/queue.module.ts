import { Global, Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import { queueClientsConfig } from './queue-clients.js';

@Global()
@Module({
  imports: [ClientsModule.registerAsync(queueClientsConfig)],
  exports: [ClientsModule],
})
export class QueueModule {}
