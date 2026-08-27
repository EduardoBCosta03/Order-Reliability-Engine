import { UnrecoverableError } from 'bullmq';

export type PaymentJobData = {
  orderId: string;
  attempt: number;
  amountCents: number;
  correlationId?: string;
};

export type PaymentWorkerConfig = {
  gatewayBaseUrl: string;
  callbackUrl: string;
  scenario?: 'success' | 'transient_failure' | 'permanent_failure';
};

export class GatewayTransientError extends Error {
  constructor(public readonly statusCode: number) {
    super(`Payment gateway transient failure: HTTP ${statusCode}`);
    this.name = 'GatewayTransientError';
  }
}

export type PaymentAccepted = {
  providerRef: string;
};

export async function processPaymentJob(
  data: PaymentJobData,
  config: PaymentWorkerConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PaymentAccepted> {
  const gatewayBaseUrl = config.gatewayBaseUrl.replace(/\/$/, '');

  const response = await fetchImpl(`${gatewayBaseUrl}/payments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(data.correlationId
        ? { 'x-correlation-id': data.correlationId }
        : {}),
    },
    body: JSON.stringify({
      orderId: data.orderId,
      attempt: data.attempt,
      amountCents: data.amountCents,
      callbackUrl: config.callbackUrl,
      scenario: config.scenario ?? 'success',
    }),
  });

  if (response.status >= 500) {
    throw new GatewayTransientError(response.status);
  }

  if (response.status >= 400) {
    throw new UnrecoverableError(
      `Payment gateway rejected request: HTTP ${response.status}`,
    );
  }

  if (!response.ok) {
    throw new GatewayTransientError(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GatewayTransientError(response.status);
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('providerRef' in payload) ||
    typeof payload.providerRef !== 'string'
  ) {
    throw new GatewayTransientError(response.status);
  }

  return {
    providerRef: payload.providerRef,
  };
}
