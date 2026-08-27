import type { PrismaClient } from '@prisma/client';

export type InventoryReservationItem = {
  productId: string;
  quantity: number;
};

export class OutOfStockError extends Error {
  constructor(public readonly productId: string) {
    super(`Insufficient stock for product ${productId}`);
    this.name = 'OutOfStockError';
  }
}

export async function reserveInventory(
  _prisma: PrismaClient,
  _items: readonly InventoryReservationItem[],
): Promise<void> {
  throw new Error('Inventory reservation is not implemented');
}
