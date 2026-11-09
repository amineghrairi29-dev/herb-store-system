import { Access } from '../auth/auth-policy.js';
import { Inject, Req, UseGuards } from '@nestjs/common';
import { CustomerGuard, type CustomerRequest } from '../customer-auth/customer.guard.js';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Header, HttpCode } from '@nestjs/common';
import { OnlineOrdersService } from './online-orders.service.js';
@Access('PUBLIC')
@Controller('public/orders')
export class PublicOrdersController {
  constructor(@Inject(OnlineOrdersService) private readonly orders: OnlineOrdersService) {}
  @Post('preview') @HttpCode(200) @Header('Cache-Control', 'no-store') preview(@Body() body: unknown) { return this.orders.preview(body); }
  @Access('PUBLIC_AUTH') @UseGuards(CustomerGuard) @Post() @Header('Cache-Control', 'no-store') create(@Body() body: unknown, @Req() request: CustomerRequest) { return this.orders.create(body, request.customer.id); }
  @Get(':reference') @Header('Cache-Control', 'no-store') lookup(@Param('reference') reference: string, @Query('phone') phone: unknown) { return this.orders.lookup(reference, phone); }
}
@Access('ONLINE_ORDERS')
@Controller('online-orders')
export class OnlineOrdersController {
  constructor(private readonly orders: OnlineOrdersService) {}
  @Get() list(@Query() query: Record<string, unknown>) { return this.orders.list(query); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.orders.detail(id); }
  @Patch(':id/status') status(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.orders.status(id, body); }
}
