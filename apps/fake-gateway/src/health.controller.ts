import { Controller, Get } from '@nestjs/common';

import { buildGatewayHealth } from './health.js';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return buildGatewayHealth();
  }
}
