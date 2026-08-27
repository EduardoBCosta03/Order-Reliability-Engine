import { Queue } from 'bullmq';

export const PAYMENT_QUEUE = 'payment-processing';

export type PaymentJobData = {
  orderId: string;
  attempt: number;
  correlationId?: string;
};

export function createPaymentQueue(redisUrl: string): Queue<PaymentJobData> {
  void redisUrl;
  throw new Error('Payment queue is not implemented');
}
