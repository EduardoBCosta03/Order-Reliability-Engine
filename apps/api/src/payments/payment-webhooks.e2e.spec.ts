import type { INestApplication } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { AppModule } from '../app.module.js';

const prisma = new PrismaClient();

describe('POST /payments/webhooks/fake-gateway', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await prisma.paymentWebhookEvent.deleteMany();
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
    await prisma.$disconnect();
  });

  it('accepts the gateway callback idempotently over HTTP', async () => {
    const product = await prisma.product.create({
      data: {
        sku: 'WEBHOOK-HTTP-ITEM',
        name: 'Webhook HTTP Item',
        unitPriceCents: 7000,
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
        idempotencyKey: 'webhook-http-001',
        requestHash: 'hash-webhook-http-001',
        totalCents: 7000,
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

    const payload = {
      eventId: 'evt-webhook-http-001',
      orderId: order.id,
      attempt: 1,
      status: 'SUCCEEDED',
      providerRef: 'provider-webhook-http-001',
    };

    const first = await request(app.getHttpServer())
      .post('/payments/webhooks/fake-gateway')
      .send(payload)
      .expect(200);

    const duplicate = await request(app.getHttpServer())
      .post('/payments/webhooks/fake-gateway')
      .send(payload)
      .expect(200);

    expect(first.body).toEqual({
      orderId: order.id,
      status: OrderStatus.CONFIRMED,
    });
    expect(duplicate.body).toEqual(first.body);

    expect(
      await prisma.paymentWebhookEvent.count({
        where: { eventId: payload.eventId },
      }),
    ).toBe(1);
  });
});
