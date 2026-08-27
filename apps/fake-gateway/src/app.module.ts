import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { PaymentsController } from './payments/payments.controller.js';

@Module({
  controllers: [HealthController, PaymentsController],
})
export class AppModule {}
