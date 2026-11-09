import { Access } from '../auth/auth-policy.js';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { PurchasesService } from './purchases.service.js';
@Access('PURCHASES')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}
  @Post() create(@Body() body: unknown) { return this.purchases.create(body); }
  @Get() findAll() { return this.purchases.findAll(); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.purchases.findOne(id); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.purchases.update(id, body); }
  @Post(':id/confirm') confirm(@Param('id', ParseIntPipe) id: number) { return this.purchases.confirm(id); }
  @Post(':id/payments') addPayment(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.purchases.addPayment(id, body); }
  @Get(':id/payments') findPayments(@Param('id', ParseIntPipe) id: number) { return this.purchases.findPayments(id); }
}
