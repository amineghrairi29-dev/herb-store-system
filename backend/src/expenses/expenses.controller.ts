import { Access } from '../auth/auth-policy.js';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
@Access('EXPENSES')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}
  @Get() list() { return this.expenses.findAll(); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.expenses.findOne(id); }
  @Post() create(@Body() body: unknown) { return this.expenses.create(body); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.expenses.update(id, body); }
}
