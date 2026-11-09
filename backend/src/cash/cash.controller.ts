import { Access } from '../auth/auth-policy.js';
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CashService } from './cash.service.js';
@Access('CASH')
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}
  @Get('summary') summary() { return this.cash.summary(); }
  @Get('movements') movements() { return this.cash.findAll(); }
  @Get('movements/:id') movement(@Param('id', ParseIntPipe) id: number) { return this.cash.findOne(id); }
  @Post('manual-in') manualIn(@Body() body: unknown) { return this.cash.manual('IN', body); }
  @Post('manual-out') manualOut(@Body() body: unknown) { return this.cash.manual('OUT', body); }
}
