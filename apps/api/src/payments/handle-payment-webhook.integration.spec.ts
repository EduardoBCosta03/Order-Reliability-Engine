import {
  OrderStatus,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { handlePaymentWebhook } from './handle-payment-webhook.js';

const prisma = new PrismaClient();

async function cleanDatabase(): Promise<void> {
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.processingEvent.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
}

async function seedPendingOrder(key: string) {
  const product = await prisma.product.create({
    data: {
      sku: `SKU-${key}`,
      name: `Product ${key}`,
      unitPriceCents: 5000,
      inventory: {
        create: {
          available: 0,
          reserved: 1,
        },
      },
    },
  });

  const order = await prisma.order.create({
    data: {
      idempotencyKey: key,
      requestHash: `hash-${key}`,
      totalCents: 5000,
      status: OrderStatus.PAYMENT_PENDING,
      items: {
        create: {
          productId: product.id,
          skuSnapshot: product.sku,
          nameSnapshot: product.name,
          quantity: 1,
          unitPriceCents: product.unitPriceCents,
        },
      },
      payments: {
        create: {
          attempt: 1,
          status: PaymentStatus.PENDING,
        },
      },
    },
  });

  return { order, product };
}

describe('payment webhook handling', () => {
  beforeEach(cleanDatabase);

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('confirms a payment exactly once for duplicate success callbacks', async () => {
    const { order, product } = await seedPendingOrder('success-1');

    const payload = {
      eventId: 'evt-success-1',
      orderId: order.id,
      attempt: 1,
      status: 'SUCCEEDED' as const,
      providerRef: 'provider-success-1',
    };

    const [first, second] = await Promise.all([
      handlePaymentWebhook(prisma, payload),
      handlePaymentWebhook(prisma, payload),
    ]);

    expect(first).toEqual({
      orderId: order.id,
      status: OrderStatus.CONFIRMED,
    });
    expect(second).toEqual(first);

    expect(
      await prisma.paymentWebhookEvent.count({
        where: { eventId: payload.eventId },
      }),
    ).toBe(1);

    const payment = await prisma.paymentAttempt.findUniqueOrThrow({
      where: {
        orderId_attempt: {
          orderId: order.id,
          attempt: 1,
        },
      },
    });

    expect(payment).toMatchObject({
      status: PaymentStatus.SUCCEEDED,
      providerRef: payload.providerRef,
    });

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId: product.id },
    });

    expect(inventory).toMatchObject({
      available: 0,
      reserved: 0,
    });
  });

  it('releases reserved stock exactly once for duplicate failed callbacks', async () => {
    const { order, product } = await seedPendingOrder('failure-1');

    const payload = {
      eventId: 'evt-failure-1',
      orderId: order.id,
      attempt: 1,
      status: 'FAILED' as const,
      providerRef: 'provider-failure-1',
      errorCode: 'PAYMENT_DECLINED',
    };

    const [first, second] = await Promise.all([
      handlePaymentWebhook(prisma, payload),
      handlePaymentWebhook(prisma, payload),
    ]);

    expect(first).toEqual({
      orderId: order.id,
      status: OrderStatus.CANCELLED,
    });
    expect(second).toEqual(first);

    expect(
      await prisma.paymentWebhookEvent.count({
        where: { eventId: payload.eventId },
      }),
    ).toBe(1);

    const payment = await prisma.paymentAttempt.findUniqueOrThrow({
      where: {
        orderId_attempt: {
          orderId: order.id,
          attempt: 1,
        },
      },
    });

    expect(payment).toMatchObject({
      status: PaymentStatus.FAILED,
      providerRef: payload.providerRef,
      errorCode: payload.errorCode,
    });

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId: product.id },
    });

    expect(inventory).toMatchObject({
      available: 1,
      reserved: 0,
    });
  });
});
