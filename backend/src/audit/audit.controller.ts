import { Controller, Get, Inject, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Access } from '../auth/auth-policy.js';
import { AuditReadService } from './audit-read.service.js';
@Access('SYSTEM') @Controller('audit-events')
export class AuditController {
  constructor(@Inject(AuditReadService) private readonly audit: AuditReadService) {}
  @Get() list(@Query() query: Record<string, unknown>) { return this.audit.list(query); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.audit.detail(id); }
}
