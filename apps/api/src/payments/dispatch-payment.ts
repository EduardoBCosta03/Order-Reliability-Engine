import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';

import type { PaymentJobData } from './payment-queue.js';

export async function dispatchPayment(
  prisma: PrismaClient,
  queue: Queue<PaymentJobData>,
  orderId: string,
  correlationId?: string,
): Promise<void> {
  void prisma;
  void queue;
  void orderId;
  void correlationId;
  throw new Error('Payment dispatch is not implemented');
}
