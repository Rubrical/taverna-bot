import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module.js';
import { CustomLoggerService } from './modules/logger/infrastructure/logger.service.js';
import { SYSTEM_LOGS_QUEUE } from './common/constants/queue-names.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Connect RabbitMQ microservice to consume the system_logs queue
  const microservice = app.get(CustomLoggerService);
  const rmqMicroservice = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: SYSTEM_LOGS_QUEUE,
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  // Use custom logger across the application
  rmqMicroservice.useLogger(microservice);
  await rmqMicroservice.listen();

  const logger = app.get(CustomLoggerService);
  logger.log('Taverna Bot is running!', 'Bootstrap');
}

bootstrap().catch(error => {
  console.error('Failed to bootstrap:', error);
  process.exit(1);
});
