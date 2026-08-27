import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';

const prisma = new PrismaClient();

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
      .send(payload)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', 'http-checkout-001')
      .send(payload)
      .expect(201);

    expect(first.headers['x-correlation-id']).toBeTruthy();
    expect(first.body).toMatchObject({
      status: 'INVENTORY_RESERVED',
      totalCents: 3300,
    });
    expect(second.body.id).toBe(first.body.id);
    expect(await prisma.order.count()).toBe(1);

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId: product.id },
    });

    expect(inventory).toMatchObject({
      available: 1,
      reserved: 1,
    });
  });
});
