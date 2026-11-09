import { Access } from '../auth/auth-policy.js';
import { Controller, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
@Access('ONLINE_ORDERS')
@Controller('online-orders')
export class OrderFulfillmentController {
  constructor(private readonly fulfillment: OrderFulfillmentService) {}
  @Post(':id/convert-to-sale') @HttpCode(200)
  convert(@Param('id', ParseIntPipe) id: number) { return this.fulfillment.convert(id); }
}
