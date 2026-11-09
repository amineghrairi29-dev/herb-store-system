import { Module } from '@nestjs/common';
import { ProductStockController, StockMovementsController } from './stock-movements.controller.js';
import { StockMovementsService } from './stock-movements.service.js';

@Module({
  controllers: [StockMovementsController, ProductStockController],
  providers: [StockMovementsService],
})
export class StockMovementsModule {}
