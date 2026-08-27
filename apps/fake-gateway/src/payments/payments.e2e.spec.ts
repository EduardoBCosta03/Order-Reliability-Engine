import { createServer } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import { AppModule } from '../app.module.js';

describe('fake payment gateway', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a payment and delivers a deterministic success callback', async () => {
    let resolveCallback:
      | ((payload: Record<string, unknown>) => void)
      | undefined;

    const callbackReceived = new Promise<Record<string, unknown>>(
      (resolve) => {
        resolveCallback = resolve;
      },
    );

    const callbackServer = createServer((req, res) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const payload = JSON.parse(
          Buffer.concat(chunks).toString('utf8'),
        ) as Record<string, unknown>;

        resolveCallback?.(payload);
        res.writeHead(204);
        res.end();
      });
    });

    await new Promise<void>((resolve) => {
      callbackServer.listen(0, '127.0.0.1', resolve);
    });

    const address = callbackServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected callback test server TCP address');
    }

    const response = await request(app.getHttpServer())
      .post('/payments')
      .send({
        orderId: 'order-success-1',
        attempt: 1,
        amountCents: 3300,
        scenario: 'success',
        callbackUrl: `http://127.0.0.1:${address.port}/callback`,
        callbackDelayMs: 0,
      })
      .expect(202);

    expect(response.body).toEqual({
      accepted: true,
      providerRef: 'pay-order-success-1-1',
    });

    const callback = await callbackReceived;

    expect(callback).toEqual({
      eventId: 'evt-order-success-1-1-succeeded',
      orderId: 'order-success-1',
      attempt: 1,
      status: 'SUCCEEDED',
      providerRef: 'pay-order-success-1-1',
    });

    await new Promise<void>((resolve, reject) => {
      callbackServer.close((error) =>
        error ? reject(error) : resolve(),
      );
    });
  });

  it('returns 503 for a simulated transient provider failure', async () => {
    await request(app.getHttpServer())
      .post('/payments')
      .send({
        orderId: 'order-retry-1',
        attempt: 1,
        amountCents: 3300,
        scenario: 'transient_failure',
        callbackUrl: 'http://127.0.0.1:1/callback',
      })
      .expect(503);
  });
});
