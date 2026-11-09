import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller.js';
import { AuditReadService } from './audit-read.service.js';
import { AuditService } from './audit.service.js';
import { AuditInterceptor } from './audit.interceptor.js';
@Module({ controllers: [AuditController], providers: [AuditService, AuditReadService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }] })
export class AuditModule {}
