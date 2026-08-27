import { Controller, Get } from '@nestjs/common';

import { buildApiHealth } from './health.js';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return buildApiHealth();
  }
}
