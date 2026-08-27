import { OrderStatus, PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { dispatchPayment } from './dispatch-payment.js';
import {
  createPaymentQueue,
  PAYMENT_QUEUE,
  type PaymentJobData,
} from './payment-queue.js';

const prisma = new PrismaClient();
const queue: Queue<PaymentJobData> = createPaymentQueue(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
);

describe('payment dispatch', () => {
  beforeEach(async () => {
    await queue.drain(true);
    await prisma.processingEvent.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
  });

  afterAll(async () => {
    await queue.close();
    await prisma.$disconnect();
  });

  it('moves a reserved order to PAYMENT_PENDING and enqueues one idempotent job', async () => {
    const order = await prisma.order.create({
      data: {
        idempotencyKey: 'dispatch-001',
        requestHash: 'hash',
        totalCents: 4200,
        status: OrderStatus.INVENTORY_RESERVED,
      },
    });

    await Promise.all([
      dispatchPayment(prisma, queue, order.id, 'corr-001'),
      dispatchPayment(prisma, queue, order.id, 'corr-001'),
    ]);

    const storedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(storedOrder.status).toBe(OrderStatus.PAYMENT_PENDING);

    const attempts = await prisma.paymentAttempt.findMany({
      where: { orderId: order.id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      attempt: 1,
      status: 'PENDING',
    });

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.queueName).toBe(PAYMENT_QUEUE);
    expect(jobs[0]?.data).toMatchObject({
      orderId: order.id,
      attempt: 1,
      correlationId: 'corr-001',
    });
  });
});
