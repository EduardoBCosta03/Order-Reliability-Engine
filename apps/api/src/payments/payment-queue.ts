import { Queue } from 'bullmq';

export const PAYMENT_QUEUE = 'payment-processing';
export const PROCESS_PAYMENT_JOB = 'process-payment';

export type PaymentJobData = {
  orderId: string;
  attempt: number;
  correlationId?: string;
};

type RedisConnection = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
};

function parseRedisUrl(redisUrl: string): RedisConnection {
  const url = new URL(redisUrl);

  const connection: RedisConnection = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
  };

  if (url.username) {
    connection.username = decodeURIComponent(url.username);
  }

  if (url.password) {
    connection.password = decodeURIComponent(url.password);
  }

  const database = url.pathname.replace(/^\//, '');
  if (database) {
    const db = Number(database);
    if (!Number.isInteger(db) || db < 0) {
      throw new Error(`Invalid Redis database index: ${database}`);
    }
    connection.db = db;
  }

  return connection;
}

export function paymentJobId(orderId: string, attempt: number): string {
  return `payment-${orderId}-${attempt}`;
}

export function createPaymentQueue(redisUrl: string): Queue<PaymentJobData> {
  return new Queue<PaymentJobData>(PAYMENT_QUEUE, {
    connection: parseRedisUrl(redisUrl),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1_000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}
