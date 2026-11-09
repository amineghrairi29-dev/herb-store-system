import { Access } from '../auth/auth-policy.js';
import { Controller, Get, Query } from '@nestjs/common';
import { FinanceService } from './finance.service.js';
@Access('FINANCE')
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('summary') summary(@Query() query: Record<string, unknown>) { return this.finance.summary(query); }
}
