import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module.js';
import { TavernaLogger } from './logger/infrastructure/taverna-logger.service';
import { QUEUES } from './queues/queue-names.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = await app.resolve(TavernaLogger);
  logger.setContext('Bootstrap');

  // Connect RabbitMQ microservice to consume the system_logs queues
  const rmqMicroservice = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
      queue: QUEUES.SYSTEM_LOGS,
      queueOptions: {
        durable: true,
      },
    },
  });

  // Use custom logger across the application
  rmqMicroservice.useLogger(await app.resolve(TavernaLogger));
  await rmqMicroservice.listen();

  logger.log('Taverna Bot is running!');
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap:', error);
  process.exit(1);
});
