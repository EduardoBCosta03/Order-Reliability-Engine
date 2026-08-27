import type { Prisma, PrismaClient } from '@prisma/client';

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

function normalizeReservationItems(
  items: readonly InventoryReservationItem[],
): InventoryReservationItem[] {
  const quantitiesByProduct = new Map<string, number>();

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new TypeError(
        `Reservation quantity must be a positive integer for product ${item.productId}`,
      );
    }

    quantitiesByProduct.set(
      item.productId,
      (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }

  return [...quantitiesByProduct.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId));
}

async function reserveNormalizedInventory(
  transaction: Prisma.TransactionClient,
  items: readonly InventoryReservationItem[],
): Promise<void> {
  for (const item of items) {
    const affectedRows = await transaction.$executeRaw`
      UPDATE "Inventory"
      SET
        "available" = "available" - ${item.quantity},
        "reserved" = "reserved" + ${item.quantity},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "productId" = ${item.productId}
        AND "available" >= ${item.quantity}
    `;

    if (affectedRows !== 1) {
      throw new OutOfStockError(item.productId);
    }
  }
}

export async function reserveInventoryInTransaction(
  transaction: Prisma.TransactionClient,
  items: readonly InventoryReservationItem[],
): Promise<void> {
  const normalizedItems = normalizeReservationItems(items);

  if (normalizedItems.length === 0) {
    return;
  }

  await reserveNormalizedInventory(transaction, normalizedItems);
}

export async function reserveInventory(
  prisma: PrismaClient,
  items: readonly InventoryReservationItem[],
): Promise<void> {
  const normalizedItems = normalizeReservationItems(items);

  if (normalizedItems.length === 0) {
    return;
  }

  await prisma.$transaction((transaction) =>
    reserveNormalizedInventory(transaction, normalizedItems),
  );
}
