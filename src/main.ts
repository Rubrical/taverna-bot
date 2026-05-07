import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module.js';
import { FileConsoleTransport } from './logger/infrastructure/file-console.transport.js';
import { TavernaLogger } from './logger/infrastructure/taverna-logger.service.js';
import { queueNames } from './infrastructure/queues/queue-clients.js';

const fileConsoleTransport = new FileConsoleTransport({
  directory: process.env.LOG_FILE_DIRECTORY,
});

async function bootstrap(): Promise<void> {
  await fileConsoleTransport.start();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = await app.resolve(TavernaLogger);

  logger.setContext('Bootstrap');
  app.useLogger(logger);

  for (const queue of queueNames) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [config.getOrThrow<string>('RABBITMQ_URL')],
        queue,
        noAck: false,
        persistent: true,
        queueOptions: {
          durable: true,
        },
      },
    });
  }

  await app.startAllMicroservices();
  await app.init();

  logger.log('Taverna Bot Application is up and running!');
}

bootstrap().catch(async (error) => {
  console.error('Failed to bootstrap:', error);
  await fileConsoleTransport.stop();
  process.exit(1);
});
