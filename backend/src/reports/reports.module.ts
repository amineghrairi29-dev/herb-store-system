import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { FinanceService } from '../finance/finance.service.js';
@Module({ controllers: [ReportsController], providers: [ReportsService, FinanceService] })
export class ReportsModule {}
