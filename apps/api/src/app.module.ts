import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { PrismaService } from './database/prisma.service.js';
import { HealthController } from './health/health.controller.js';
import { CorrelationIdMiddleware } from './http/correlation-id.middleware.js';
import { OrdersController } from './orders/orders.controller.js';
import { PaymentQueueService } from './payments/payment-queue.service.js';
import { PaymentWebhooksController } from './payments/payment-webhooks.controller.js';

@Module({
  controllers: [
    HealthController,
    OrdersController,
    PaymentWebhooksController,
  ],
  providers: [PrismaService, PaymentQueueService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
