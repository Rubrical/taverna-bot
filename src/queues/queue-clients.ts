import { ClientsModuleAsyncOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

import { QUEUES } from './queue-names.js';

export const queueClientsConfig: ClientsModuleAsyncOptions = [
  {
    name: QUEUES.SYSTEM_LOGS,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      transport: Transport.RMQ,
      options: {
        urls: [config.getOrThrow<string>('RABBITMQ_URL')],
        queue: QUEUES.SYSTEM_LOGS,
        persistent: true,
        queueOptions: {
          durable: true,
        },
      },
    }),
  },
];
