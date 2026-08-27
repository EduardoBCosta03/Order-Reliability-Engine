import {
  Injectable,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  createPaymentQueue,
  type PaymentJobData,
} from './payment-queue.js';

@Injectable()
export class PaymentQueueService implements OnModuleDestroy {
  readonly queue: Queue<PaymentJobData>;

  constructor() {
    this.queue = createPaymentQueue(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
