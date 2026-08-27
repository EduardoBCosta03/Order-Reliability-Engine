import { describe, expect, it } from 'vitest';

import { OrderStatus } from './order-status.js';
import * as stateMachineModule from './order-state-machine.js';

type StateMachineContract = {
  canTransition(from: OrderStatus, to: OrderStatus): boolean;
  assertOrderTransition(from: OrderStatus, to: OrderStatus): void;
};

const stateMachine = stateMachineModule as Partial<StateMachineContract>;

describe('order state machine', () => {
  it('allows the happy-path transitions', () => {
    expect(typeof stateMachine.canTransition).toBe('function');
    if (!stateMachine.canTransition) return;

    expect(
      stateMachine.canTransition(
        OrderStatus.CREATED,
        OrderStatus.INVENTORY_RESERVED,
      ),
    ).toBe(true);
    expect(
      stateMachine.canTransition(
        OrderStatus.INVENTORY_RESERVED,
        OrderStatus.PAYMENT_PENDING,
      ),
    ).toBe(true);
    expect(
      stateMachine.canTransition(
        OrderStatus.PAYMENT_PENDING,
        OrderStatus.CONFIRMED,
      ),
    ).toBe(true);
  });

  it('rejects skipping directly from CREATED to CONFIRMED', () => {
    expect(typeof stateMachine.assertOrderTransition).toBe('function');
    if (!stateMachine.assertOrderTransition) return;

    expect(() =>
      stateMachine.assertOrderTransition(
        OrderStatus.CREATED,
        OrderStatus.CONFIRMED,
      ),
    ).toThrow('Invalid order transition: CREATED -> CONFIRMED');
  });

  it('allows the payment failure compensation path', () => {
    expect(typeof stateMachine.canTransition).toBe('function');
    if (!stateMachine.canTransition) return;

    expect(
      stateMachine.canTransition(
        OrderStatus.PAYMENT_PENDING,
        OrderStatus.PAYMENT_FAILED,
      ),
    ).toBe(true);
    expect(
      stateMachine.canTransition(
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.CANCELLED,
      ),
    ).toBe(true);
  });
});
