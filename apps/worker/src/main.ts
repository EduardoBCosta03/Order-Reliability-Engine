import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';

import {
  PAYMENT_QUEUE,
  parseRedisConnection,
} from './queue/payment-queue.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger('PaymentWorker');
  const connection = parseRedisConnection(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );

  const worker = new Worker(
    PAYMENT_QUEUE,
    async (job) => {
      logger.warn(
        `Received payment job ${job.id ?? 'unknown'} before payment processing is implemented`,
      );
      throw new Error('Payment processing is not implemented yet');
    },
    { connection },
  );

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await app.close();
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  logger.log(`Listening on BullMQ queue: ${PAYMENT_QUEUE}`);
}

void bootstrap();
