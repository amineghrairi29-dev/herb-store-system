import { Access } from '../auth/auth-policy.js';
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { reportKind } from './report-query.js';
import { reportCsv } from './report-csv.js';
@Access('REPORTS')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get(':kind/export.csv') async csv(@Param('kind') raw: string, @Query() query: Record<string, unknown>, @Res() response: Response) {
    const kind = reportKind(raw), report = await this.reports.report(kind, query, true);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8'); response.setHeader('Content-Disposition', `attachment; filename="${kind}-${report.period.dateFrom}-${report.period.dateTo}.csv"`); response.setHeader('Cache-Control', 'no-store'); response.send(reportCsv(report));
  }
  @Get(':kind') report(@Param('kind') kind: string, @Query() query: Record<string, unknown>) { return this.reports.report(reportKind(kind), query); }
}
