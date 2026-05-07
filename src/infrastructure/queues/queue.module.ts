import { Global, Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import { queueClientsConfig } from './queue-clients.js';

@Global()
@Module({
  /* Automatic queues register for cleaner implementation and easier to use, develop and navigate codebase. */
  imports: [ClientsModule.registerAsync(queueClientsConfig)],
  exports: [ClientsModule],
})
export class QueueModule {}
