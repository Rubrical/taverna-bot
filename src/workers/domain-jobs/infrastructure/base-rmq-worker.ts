import type { RmqContext } from '@nestjs/microservices';
import type { Channel, Message, Options } from 'amqplib';

import type { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import type { RetryBackoffService } from '../application/retry-backoff.service.js';
import { DomainJobUnknownError } from '../domain/errors/domain-job-unknown.error.js';
import type { DomainWorkerFailure } from '../domain/interfaces/domain-worker-failure.interface.js';
import type { DomainWorkerOptions } from '../domain/interfaces/domain-worker-options.interface.js';

const ATTEMPT_HEADER = 'x-taverna-attempt';
const SOURCE_QUEUE_HEADER = 'x-taverna-source-queue';

export abstract class BaseRmqWorker<TPayload> {
  protected constructor(
    private readonly options: DomainWorkerOptions,
    private readonly logger: TavernaLogger,
    private readonly backoffService: RetryBackoffService,
  ) {
    this.logger.setContext(options.workerName);
  }

  async handle(payload: TPayload, context: RmqContext): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as Message;

    try {
      await this.process(payload);
      channel.ack(message);
    } catch (error: unknown) {
      await this.handleFailure(payload, error, channel, message);
    }
  }

  protected abstract process(payload: TPayload): Promise<void>;

  private async handleFailure(payload: TPayload, error: unknown, channel: Channel, message: Message): Promise<void> {
    const normalizedError = this.toError(error);
    const currentAttempt = this.resolveCurrentAttempt(message);

    this.logger.error(`Domain job failed: ${this.options.workerName}`, normalizedError, {
      workerName: this.options.workerName,
      queue: this.options.queue,
      attempt: currentAttempt,
      maxAttempts: this.options.retry.maxAttempts,
    });

    try {
      await this.assertFailureQueues(channel);

      if (currentAttempt >= this.options.retry.maxAttempts) {
        this.publishDeadLetter(channel, payload, normalizedError, currentAttempt);
        channel.ack(message);
        return;
      }

      this.publishRetry(channel, payload, message, currentAttempt + 1);
      channel.ack(message);
    } catch (publishError: unknown) {
      this.logger.error(`Failed to publish domain job retry: ${this.options.workerName}`, this.toError(publishError), {
        workerName: this.options.workerName,
        queue: this.options.queue,
        attempt: currentAttempt,
      });
      channel.nack(message, false, true);
    }
  }

  private async assertFailureQueues(channel: Channel): Promise<void> {
    await channel.assertQueue(this.options.retryQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: this.options.queue,
    });
    await channel.assertQueue(this.options.deadLetterQueue, { durable: true });
  }

  private publishRetry(channel: Channel, payload: TPayload, message: Message, nextAttempt: number): void {
    const delayMs = this.backoffService.calculateDelayMs(nextAttempt - 1, this.options.retry);
    const headers = {
      ...message.properties.headers,
      [ATTEMPT_HEADER]: nextAttempt,
      [SOURCE_QUEUE_HEADER]: this.options.queue,
    };

    channel.sendToQueue(this.options.retryQueue, this.serialize(payload), {
      contentType: 'application/json',
      persistent: true,
      expiration: String(delayMs),
      headers,
    });
  }

  private publishDeadLetter(channel: Channel, payload: TPayload, error: Error, attempts: number): void {
    const failure: DomainWorkerFailure<TPayload> = {
      payload,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      metadata: {
        workerName: this.options.workerName,
        queue: this.options.queue,
        attempts,
        failedAt: new Date().toISOString(),
      },
    };
    const publishOptions: Options.Publish = {
      contentType: 'application/json',
      persistent: true,
      headers: {
        [ATTEMPT_HEADER]: attempts,
        [SOURCE_QUEUE_HEADER]: this.options.queue,
      },
    };

    channel.sendToQueue(this.options.deadLetterQueue, this.serialize(failure), publishOptions);
  }

  private resolveCurrentAttempt(message: Message): number {
    const rawHeaders: unknown = message.properties.headers;

    if (!rawHeaders || typeof rawHeaders !== 'object') {
      return 1;
    }

    const headerValue = (rawHeaders as Record<string, unknown>)[ATTEMPT_HEADER];

    if (typeof headerValue === 'number' && Number.isInteger(headerValue) && headerValue > 0) {
      return headerValue;
    }

    if (typeof headerValue === 'string') {
      const parsed = Number(headerValue);

      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return 1;
  }

  private serialize(value: unknown): Buffer {
    return Buffer.from(JSON.stringify(value));
  }

  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new DomainJobUnknownError(String(error));
  }
}
