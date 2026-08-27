import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { createPaymentQueue } from '../payments/payment-queue.js';

const prisma = new PrismaClient();
const paymentQueue = createPaymentQueue(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
);

describe('POST /orders', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await paymentQueue.drain(true);
    await prisma.processingEvent.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await paymentQueue.close();
    await prisma.$disconnect();
  });

  it('creates an idempotent inventory-reserved order over HTTP', async () => {
    const product = await prisma.product.create({
      data: {
        sku: 'HTTP-ORDER-ITEM',
        name: 'HTTP Order Item',
        unitPriceCents: 3300,
        inventory: {
          create: {
            available: 2,
            reserved: 0,
          },
        },
      },
    });

    const payload = {
      items: [{ productId: product.id, quantity: 1 }],
    };

    const first = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', 'http-checkout-001')
      .send(payload);

    if (first.status !== 201) {
      throw new Error(
        `Expected first POST /orders to return 201, got ${first.status}: ${JSON.stringify(first.body)}`,
      );
    }

    const second = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', 'http-checkout-001')
      .send(payload);

    if (second.status !== 201) {
      throw new Error(
        `Expected duplicate POST /orders to return 201, got ${second.status}: ${JSON.stringify(second.body)}`,
      );
    }

    expect(first.headers['x-correlation-id']).toBeTruthy();
    expect(first.body).toMatchObject({
      status: 'PAYMENT_PENDING',
      totalCents: 3300,
    });
    expect(second.body.id).toBe(first.body.id);
    expect(await prisma.order.count()).toBe(1);

    const jobs = await paymentQueue.getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data).toMatchObject({
      orderId: first.body.id,
      attempt: 1,
    });

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId: product.id },
    });

    expect(inventory).toMatchObject({
      available: 1,
      reserved: 1,
    });
  });
});
