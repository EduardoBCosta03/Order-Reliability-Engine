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
  _data: PaymentJobData,
  _config: PaymentWorkerConfig,
  _fetch: typeof fetch = fetch,
): Promise<PaymentAccepted> {
  void _data;
  void _config;
  void _fetch;
  void UnrecoverableError;
  throw new Error('Payment worker processing is not implemented');
}
