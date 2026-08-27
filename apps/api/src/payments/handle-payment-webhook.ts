import type { PrismaClient } from '@prisma/client';

export type PaymentWebhookPayload = {
  eventId: string;
  orderId: string;
  attempt: number;
  status: 'SUCCEEDED' | 'FAILED';
  providerRef: string;
  errorCode?: string;
};

export type PaymentWebhookResult = {
  orderId: string;
  status: string;
};

export async function handlePaymentWebhook(
  _prisma: PrismaClient,
  _payload: PaymentWebhookPayload,
): Promise<PaymentWebhookResult> {
  void _prisma;
  void _payload;
  throw new Error('Payment webhook handling is not implemented');
}
