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

@Module({
  controllers: [HealthController, OrdersController],
  providers: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
