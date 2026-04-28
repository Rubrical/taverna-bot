import { ClientsModuleAsyncOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

import { QUEUES } from './queue-names.js';

export const queueNames = [QUEUES.SYSTEM_LOGS] as const;
export const queueClientsConfig: ClientsModuleAsyncOptions = queueNames.map((queue) => ({
  name: queue,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    transport: Transport.RMQ,
    options: {
      urls: [config.getOrThrow<string>('RABBITMQ_URL')],
      queue,
      persistent: true,
      queueOptions: {
        durable: true,
      },
    },
  }),
}));
