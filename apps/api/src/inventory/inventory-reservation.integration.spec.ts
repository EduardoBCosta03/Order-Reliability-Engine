import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  OutOfStockError,
  reserveInventory,
} from './inventory-reservation.js';

const prisma = new PrismaClient();

describe('inventory reservation concurrency', () => {
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

  it('allows exactly one reservation to consume the final unit', async () => {
    const product = await prisma.product.create({
      data: {
        sku: 'LAST-ITEM',
        name: 'Last Item',
        unitPriceCents: 1200,
        inventory: {
          create: {
            available: 1,
            reserved: 0,
          },
        },
      },
    });

    const attempts = await Promise.allSettled([
      reserveInventory(prisma, [{ productId: product.id, quantity: 1 }]),
      reserveInventory(prisma, [{ productId: product.id, quantity: 1 }]),
    ]);

    const fulfilled = attempts.filter(
      (attempt) => attempt.status === 'fulfilled',
    );
    const rejected = attempts.filter(
      (attempt) => attempt.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: expect.any(OutOfStockError),
    });

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId: product.id },
    });

    expect(inventory).toMatchObject({
      available: 0,
      reserved: 1,
    });
  });
});
