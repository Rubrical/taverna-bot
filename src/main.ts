import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module.js';
import { TavernaLogger } from './logger/infrastructure/taverna-logger.service.js';
import { QUEUES } from './queues/queue-names.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = await app.resolve(TavernaLogger);

  logger.setContext('Bootstrap');
  app.useLogger(logger);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [config.getOrThrow<string>('RABBITMQ_URL')],
      queue: QUEUES.SYSTEM_LOGS,
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.init();

  logger.log('Taverna Bot Applcation is up and running!');
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap:', error);
  process.exit(1);
});
