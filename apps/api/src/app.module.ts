import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { HealthController } from './health/health.controller.js';
import { CorrelationIdMiddleware } from './http/correlation-id.middleware.js';

@Module({
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
