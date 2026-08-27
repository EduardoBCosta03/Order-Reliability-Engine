import {
  OrderStatus,
  PaymentStatus,
  type PrismaClient,
} from '@prisma/client';
import type { Queue } from 'bullmq';

import {
  PROCESS_PAYMENT_JOB,
  paymentJobId,
  type PaymentJobData,
} from './payment-queue.js';

export class PaymentDispatchStateError extends Error {
  constructor(
    public readonly orderId: string,
    public readonly status: OrderStatus,
  ) {
    super(`Cannot dispatch payment for order ${orderId} in status ${status}`);
    this.name = 'PaymentDispatchStateError';
  }
}

export async function dispatchPayment(
  prisma: PrismaClient,
  queue: Queue<PaymentJobData>,
  orderId: string,
  correlationId?: string,
): Promise<void> {
  const attempt = 1;

  const status = await prisma.$transaction(async (transaction) => {
    const transitioned = await transaction.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.INVENTORY_RESERVED,
      },
      data: {
        status: OrderStatus.PAYMENT_PENDING,
      },
    });

    const order = await transaction.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new PaymentDispatchStateError(orderId, order.status);
    }

    await transaction.paymentAttempt.upsert({
      where: {
        orderId_attempt: {
          orderId,
          attempt,
        },
      },
      create: {
        orderId,
        attempt,
        status: PaymentStatus.PENDING,
      },
      update: {},
    });

    if (transitioned.count === 1) {
      await transaction.processingEvent.create({
        data: {
          orderId,
          type: 'PAYMENT_PENDING',
          ...(correlationId ? { correlationId } : {}),
        },
      });
    }

    return order.status;
  });

  if (status !== OrderStatus.PAYMENT_PENDING) {
    throw new PaymentDispatchStateError(orderId, status);
  }

  await queue.add(
    PROCESS_PAYMENT_JOB,
    {
      orderId,
      attempt,
      ...(correlationId ? { correlationId } : {}),
    },
    {
      jobId: paymentJobId(orderId, attempt),
    },
  );
}
