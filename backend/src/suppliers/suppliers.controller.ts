import { Access } from '../auth/auth-policy.js';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';
@Access('SUPPLIERS')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}
  @Post()
  create(@Body() body: unknown) { return this.suppliers.create(body); }
  @Get()
  findAll() { return this.suppliers.findAll(); }
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.suppliers.findOne(id); }
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.suppliers.update(id, body); }
}
