import { Access } from '../auth/auth-policy.js';
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service.js';

@Access('STOCK')
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  @Post()
  create(@Body() body: unknown) { return this.movements.create(body); }

  @Get()
  findAll() { return this.movements.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.movements.findOne(id); }
}

@Access('STOCK')
@Controller('products')
export class ProductStockController {
  constructor(private readonly movements: StockMovementsService) {}

  @Get(':id/stock')
  stock(@Param('id', ParseIntPipe) id: number) { return this.movements.stock(id); }
}
