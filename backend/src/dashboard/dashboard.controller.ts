import { BadRequestException, Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { Access } from '../auth/auth-policy.js';
import type { AuthRequest } from '../auth/auth.guard.js';
import { DashboardService } from './dashboard.service.js';
@Access('AUTH') @Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}
  @Get() summary(@Req() request: AuthRequest, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length) throw new BadRequestException('Le tableau de bord utilise la date et le rôle de votre session, sans filtre.');
    return this.dashboard.summary(request.user.role);
  }
}
