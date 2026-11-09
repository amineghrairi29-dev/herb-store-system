import { Access } from '../auth/auth-policy.js';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { SalesService } from './sales.service.js';
@Access('SALES')
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}
  @Post() create(@Body() body: unknown) { return this.sales.create(body); }
  @Get() findAll() { return this.sales.findAll(); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.sales.findOne(id); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.sales.update(id, body); }
  @Post(':id/confirm') confirm(@Param('id', ParseIntPipe) id: number) { return this.sales.confirm(id); }
  @Post(':id/payments') addPayment(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.sales.addPayment(id, body); }
  @Get(':id/payments') findPayments(@Param('id', ParseIntPipe) id: number) { return this.sales.findPayments(id); }
}
