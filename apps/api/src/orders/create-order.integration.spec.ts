import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createOrder } from './create-order.js';

const prisma = new PrismaClient();

describe('idempotent order creation', () => {
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
    await prisma.$disconnect();
  });

  it('creates one order and reserves stock once for concurrent duplicate requests', async () => {
    const product = await prisma.product.create({
      data: {
        sku: 'IDEMPOTENT-ITEM',
        name: 'Idempotent Item',
        unitPriceCents: 2500,
        inventory: {
          create: {
            available: 2,
            reserved: 0,
          },
        },
      },
    });

    const request = {
      idempotencyKey: 'checkout-request-001',
      correlationId: 'test-correlation-id',
      items: [{ productId: product.id, quantity: 1 }],
    } as const;

    const [first, second] = await Promise.all([
      createOrder(prisma, request),
      createOrder(prisma, request),
    ]);

    expect(first.id).toBe(second.id);
    expect(first.status).toBe('INVENTORY_RESERVED');
    expect(first.totalCents).toBe(2500);

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
