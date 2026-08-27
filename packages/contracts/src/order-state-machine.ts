import { OrderStatus } from './order-status.js';

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.INVENTORY_RESERVED],
  [OrderStatus.INVENTORY_RESERVED]: [OrderStatus.PAYMENT_PENDING],
  [OrderStatus.PAYMENT_PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.PAYMENT_FAILED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid order transition: ${from} -> ${to}`);
  }
}
