import type { PrismaClient } from '@prisma/client';

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
    super(`Idempotency key ${idempotencyKey} was already used with a different request`);
    this.name = 'IdempotencyConflictError';
  }
}

export async function createOrder(
  prisma: PrismaClient,
  input: CreateOrderInput,
): Promise<CreatedOrder> {
  void prisma;
  void input;
  throw new Error('Order creation is not implemented');
}
