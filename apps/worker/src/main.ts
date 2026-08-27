import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';

import {
  processPaymentJob,
  type PaymentJobData,
  type PaymentWorkerConfig,
} from './payments/process-payment.js';
import {
  PAYMENT_QUEUE,
  parseRedisConnection,
} from './queue/payment-queue.js';
import { WorkerModule } from './worker.module.js';

function paymentScenario():
  | PaymentWorkerConfig['scenario']
  | undefined {
  const value = process.env.FAKE_GATEWAY_SCENARIO;

  if (!value) {
    return undefined;
  }

  if (
    value === 'success' ||
    value === 'transient_failure' ||
    value === 'permanent_failure'
  ) {
    return value;
  }

  throw new Error(`Unsupported FAKE_GATEWAY_SCENARIO: ${value}`);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger('PaymentWorker');
  const connection = parseRedisConnection(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );

  const scenario = paymentScenario();
  const config: PaymentWorkerConfig = {
    gatewayBaseUrl:
      process.env.FAKE_GATEWAY_URL ?? 'http://localhost:3002',
    callbackUrl:
      process.env.PAYMENT_CALLBACK_URL ??
      'http://localhost:3001/payments/webhooks/fake-gateway',
    ...(scenario ? { scenario } : {}),
  };

  const worker = new Worker<PaymentJobData>(
    PAYMENT_QUEUE,
    async (job) => {
      logger.log(
        `Processing payment job ${job.id ?? 'unknown'} for order ${job.data.orderId}, BullMQ attempt ${job.attemptsMade + 1}`,
      );

      const result = await processPaymentJob(job.data, config);

      logger.log(
        `Gateway accepted order ${job.data.orderId} as ${result.providerRef}`,
      );

      return result;
    },
    { connection },
  );

  worker.on('failed', (job, error) => {
    logger.error(
      `Payment job ${job?.id ?? 'unknown'} failed: ${error.message}`,
    );
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await app.close();
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  logger.log(`Listening on BullMQ queue: ${PAYMENT_QUEUE}`);
}

void bootstrap();
