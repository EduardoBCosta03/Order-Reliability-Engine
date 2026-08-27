import { createHash } from 'node:crypto';

import {
  OrderStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';

import { reserveInventoryInTransaction } from '../inventory/inventory-reservation.js';

export type CreateOrderItem = {
  productId: string;
  quantity: number;
};

export type CreateOrderInput = {
  idempotencyKey: string;
  items: readonly CreateOrderItem[];
  correlationId?: string;
};

export type CreatedOrder = {
  id: string;
  status: string;
  totalCents: number;
};

export class IdempotencyConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(
      `Idempotency key ${idempotencyKey} was already used with a different request`,
    );
    this.name = 'IdempotencyConflictError';
  }
}

export class UnknownProductError extends Error {
  constructor(public readonly productId: string) {
    super(`Unknown product ${productId}`);
    this.name = 'UnknownProductError';
  }
}

type NormalizedOrderItem = {
  productId: string;
  quantity: number;
};

function normalizeItems(
  items: readonly CreateOrderItem[],
): NormalizedOrderItem[] {
  if (items.length === 0) {
    throw new TypeError('Order must contain at least one item');
  }

  const quantitiesByProduct = new Map<string, number>();

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new TypeError(
        `Order quantity must be a positive integer for product ${item.productId}`,
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

function requestHash(items: readonly NormalizedOrderItem[]): string {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

function toCreatedOrder(order: {
  id: string;
  status: OrderStatus;
  totalCents: number;
}): CreatedOrder {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
  };
}

async function resolveExistingOrder(
  prisma: PrismaClient,
  idempotencyKey: string,
  hash: string,
): Promise<CreatedOrder | null> {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      status: true,
      totalCents: true,
      requestHash: true,
    },
  });

  if (!existing) {
    return null;
  }

  if (existing.requestHash !== hash) {
    throw new IdempotencyConflictError(idempotencyKey);
  }

  return toCreatedOrder(existing);
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return 'code' in error && error.code === 'P2002';
}

async function createOrderTransaction(
  transaction: Prisma.TransactionClient,
  input: CreateOrderInput,
  items: readonly NormalizedOrderItem[],
  hash: string,
): Promise<CreatedOrder> {
  const products = await transaction.product.findMany({
    where: {
      id: {
        in: items.map((item) => item.productId),
      },
    },
    select: {
      id: true,
      sku: true,
      name: true,
      unitPriceCents: true,
    },
  });

  const productsById = new Map(
    products.map((product) => [product.id, product] as const),
  );

  for (const item of items) {
    if (!productsById.has(item.productId)) {
      throw new UnknownProductError(item.productId);
    }
  }

  const totalCents = items.reduce((total, item) => {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new UnknownProductError(item.productId);
    }

    return total + product.unitPriceCents * item.quantity;
  }, 0);

  const order = await transaction.order.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      requestHash: hash,
      totalCents,
      status: OrderStatus.CREATED,
      items: {
        create: items.map((item) => {
          const product = productsById.get(item.productId);
          if (!product) {
            throw new UnknownProductError(item.productId);
          }

          return {
            productId: product.id,
            skuSnapshot: product.sku,
            nameSnapshot: product.name,
            quantity: item.quantity,
            unitPriceCents: product.unitPriceCents,
          };
        }),
      },
    },
    select: {
      id: true,
      status: true,
      totalCents: true,
    },
  });

  await transaction.idempotencyRecord.create({
    data: {
      key: input.idempotencyKey,
      requestHash: hash,
      orderId: order.id,
    },
  });

  await transaction.processingEvent.create({
    data: {
      orderId: order.id,
      type: 'ORDER_CREATED',
      ...(input.correlationId
        ? { correlationId: input.correlationId }
        : {}),
    },
  });

  await reserveInventoryInTransaction(transaction, items);

  const reservedOrder = await transaction.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.INVENTORY_RESERVED,
    },
    select: {
      id: true,
      status: true,
      totalCents: true,
    },
  });

  await transaction.processingEvent.create({
    data: {
      orderId: order.id,
      type: 'INVENTORY_RESERVED',
      ...(input.correlationId
        ? { correlationId: input.correlationId }
        : {}),
    },
  });

  return toCreatedOrder(reservedOrder);
}

export async function createOrder(
  prisma: PrismaClient,
  input: CreateOrderInput,
): Promise<CreatedOrder> {
  const idempotencyKey = input.idempotencyKey.trim();

  if (!idempotencyKey) {
    throw new TypeError('Idempotency key is required');
  }

  const items = normalizeItems(input.items);
  const hash = requestHash(items);

  const existing = await resolveExistingOrder(
    prisma,
    idempotencyKey,
    hash,
  );

  if (existing) {
    return existing;
  }

  const normalizedInput: CreateOrderInput = {
    ...input,
    idempotencyKey,
  };

  try {
    return await prisma.$transaction((transaction) =>
      createOrderTransaction(
        transaction,
        normalizedInput,
        items,
        hash,
      ),
    );
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }

    const racedOrder = await resolveExistingOrder(
      prisma,
      idempotencyKey,
      hash,
    );

    if (!racedOrder) {
      throw error;
    }

    return racedOrder;
  }
}
