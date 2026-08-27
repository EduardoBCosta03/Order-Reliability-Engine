export const PAYMENT_QUEUE = 'payment-processing';

export type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
};

export function parseRedisConnection(redisUrl: string): RedisConnectionOptions {
  const url = new URL(redisUrl);
  const connection: RedisConnectionOptions = {
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
