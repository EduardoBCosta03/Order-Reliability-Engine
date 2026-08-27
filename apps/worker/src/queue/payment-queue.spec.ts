import { describe, expect, it } from 'vitest';

import * as paymentQueueModule from './payment-queue.js';

type PaymentQueueContract = {
  PAYMENT_QUEUE: string;
  parseRedisConnection(redisUrl: string): {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
  };
};

const queue = paymentQueueModule as Partial<PaymentQueueContract>;

describe('payment queue configuration', () => {
  it('uses a stable queue name', () => {
    expect(queue.PAYMENT_QUEUE).toBe('payment-processing');
  });

  it('parses a Redis URL into BullMQ connection options', () => {
    expect(typeof queue.parseRedisConnection).toBe('function');
    if (!queue.parseRedisConnection) return;

    expect(
      queue.parseRedisConnection('redis://user:secret@redis.internal:6380/2'),
    ).toEqual({
      host: 'redis.internal',
      port: 6380,
      username: 'user',
      password: 'secret',
      db: 2,
    });
  });
});
