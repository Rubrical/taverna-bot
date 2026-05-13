import type { RmqContext } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';

import { RetryBackoffService } from '../../../src/workers/domain-jobs/application/retry-backoff.service';
import type { DomainWorkerOptions } from '../../../src/workers/domain-jobs/domain/interfaces/domain-worker-options.interface';
import { BaseRmqWorker } from '../../../src/workers/domain-jobs/infrastructure/base-rmq-worker';
import type { TavernaLogger } from '../../../src/logger/infrastructure/taverna-logger.service';

interface TestPayload {
  readonly id: string;
}

type ChannelMock = {
  ack: jest.Mock<void, Parameters<Channel['ack']>>;
  nack: jest.Mock<void, Parameters<Channel['nack']>>;
  assertQueue: jest.Mock<ReturnType<Channel['assertQueue']>, Parameters<Channel['assertQueue']>>;
  sendToQueue: jest.Mock<ReturnType<Channel['sendToQueue']>, Parameters<Channel['sendToQueue']>>;
};

type LoggerMock = {
  setContext: jest.Mock;
  error: jest.Mock;
};

function createAssertQueueMock(): ChannelMock['assertQueue'] {
  return jest
    .fn<ReturnType<Channel['assertQueue']>, Parameters<Channel['assertQueue']>>()
    .mockResolvedValue({ queue: '', messageCount: 0, consumerCount: 0 });
}

function createSendToQueueMock(): ChannelMock['sendToQueue'] {
  return jest.fn<ReturnType<Channel['sendToQueue']>, Parameters<Channel['sendToQueue']>>().mockReturnValue(true);
}

class TestWorker extends BaseRmqWorker<TestPayload> {
  readonly processMock = jest.fn<Promise<void>, [TestPayload]>().mockResolvedValue(undefined);

  constructor(options: DomainWorkerOptions, logger: TavernaLogger, backoffService: RetryBackoffService) {
    super(options, logger, backoffService);
  }

  protected process(payload: TestPayload): Promise<void> {
    return this.processMock(payload);
  }
}

function createMessage(headers?: Record<string, unknown>): Message {
  return {
    content: Buffer.from(''),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: '',
      routingKey: '',
    },
    properties: {
      contentType: undefined,
      contentEncoding: undefined,
      headers,
      deliveryMode: undefined,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}

function createContext(message = createMessage()): {
  readonly channel: ChannelMock;
  readonly context: RmqContext;
  readonly message: Message;
} {
  const channel: ChannelMock = {
    ack: jest.fn<void, Parameters<Channel['ack']>>(),
    nack: jest.fn<void, Parameters<Channel['nack']>>(),
    assertQueue: createAssertQueueMock(),
    sendToQueue: createSendToQueueMock(),
  };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;

  return { channel, context, message };
}

describe('BaseRmqWorker', () => {
  const options: DomainWorkerOptions = {
    workerName: 'TestWorker',
    queue: 'domain_jobs',
    retryQueue: 'domain_jobs_retry',
    deadLetterQueue: 'domain_jobs_dlq',
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1_000,
      backoffMultiplier: 2,
      maxDelayMs: 10_000,
    },
  };

  let logger: LoggerMock;
  let worker: TestWorker;

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      error: jest.fn(),
    };
    worker = new TestWorker(options, logger as unknown as TavernaLogger, new RetryBackoffService());
  });

  it('should process and ack the message on success', async () => {
    const { channel, context, message } = createContext();
    const payload = { id: 'job-1' };

    await worker.handle(payload, context);

    expect(worker.processMock).toHaveBeenCalledWith(payload);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('should publish retry and ack when processing fails below max attempts', async () => {
    const { channel, context, message } = createContext();
    const payload = { id: 'job-1' };
    worker.processMock.mockRejectedValueOnce(new Error('temporary failure'));

    await worker.handle(payload, context);

    expect(channel.assertQueue).toHaveBeenCalledWith(options.retryQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: options.queue,
    });
    const publishCall = channel.sendToQueue.mock.calls[0];
    expect(publishCall?.[0]).toBe(options.retryQueue);
    expect(publishCall?.[1]).toEqual(Buffer.from(JSON.stringify(payload)));
    expect(publishCall?.[2]?.expiration).toBe('1000');
    expect(publishCall?.[2]?.headers).toMatchObject({
      'x-taverna-attempt': 2,
      'x-taverna-source-queue': options.queue,
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('should publish dead-letter and ack when max attempts is reached', async () => {
    const message = createMessage({ 'x-taverna-attempt': 3 });
    const { channel, context } = createContext(message);
    worker.processMock.mockRejectedValueOnce(new Error('permanent failure'));

    await worker.handle({ id: 'job-1' }, context);

    const publishCall = channel.sendToQueue.mock.calls[0];
    expect(publishCall?.[0]).toBe(options.deadLetterQueue);
    expect(publishCall?.[1]).toEqual(expect.any(Buffer));
    expect(publishCall?.[2]?.headers).toMatchObject({
      'x-taverna-attempt': 3,
      'x-taverna-source-queue': options.queue,
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('should nack the original message when retry publishing fails', async () => {
    const { channel, context, message } = createContext();
    worker.processMock.mockRejectedValueOnce(new Error('temporary failure'));
    channel.assertQueue.mockRejectedValueOnce(new Error('rabbit unavailable'));

    await worker.handle({ id: 'job-1' }, context);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });

  it('should log processing failures with job metadata', async () => {
    const { context } = createContext();
    worker.processMock.mockRejectedValueOnce(new Error('temporary failure'));

    await worker.handle({ id: 'job-1' }, context);

    expect(logger.error).toHaveBeenCalledWith(
      'Domain job failed: TestWorker',
      expect.any(Error),
      expect.objectContaining({
        workerName: options.workerName,
        queue: options.queue,
        attempt: 1,
        maxAttempts: 3,
      }),
    );
  });
});
