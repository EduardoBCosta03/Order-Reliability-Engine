import { UnrecoverableError } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import {
  GatewayTransientError,
  processPaymentJob,
} from './process-payment.js';

const data = {
  orderId: 'order-1',
  attempt: 1,
  amountCents: 3300,
  correlationId: 'corr-1',
} as const;

const config = {
  gatewayBaseUrl: 'http://fake-gateway:3002',
  callbackUrl:
    'http://api:3001/payments/webhooks/fake-gateway',
  scenario: 'success' as const,
};

describe('payment worker processing', () => {
  it('submits the queued payment to the fake gateway', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          providerRef: 'pay-order-1-1',
        }),
        {
          status: 202,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    await expect(
      processPaymentJob(data, config, fetchMock),
    ).resolves.toEqual({
      providerRef: 'pay-order-1-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe('http://fake-gateway:3002/payments');
    expect(options?.method).toBe('POST');

    expect(JSON.parse(String(options?.body))).toEqual({
      orderId: 'order-1',
      attempt: 1,
      amountCents: 3300,
      callbackUrl:
        'http://api:3001/payments/webhooks/fake-gateway',
      scenario: 'success',
    });
  });

  it('throws a retryable error for gateway 5xx responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      processPaymentJob(data, config, fetchMock),
    ).rejects.toBeInstanceOf(GatewayTransientError);
  });

  it('marks gateway 4xx responses as unrecoverable', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 422 }));

    await expect(
      processPaymentJob(data, config, fetchMock),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
