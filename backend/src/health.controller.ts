import { Controller, Get } from '@nestjs/common';
import { Access } from './auth/auth-policy.js';

@Access('PUBLIC')
@Controller('health')
export class HealthController {
  @Get()
  health() { return { status: 'ok' }; }
}
