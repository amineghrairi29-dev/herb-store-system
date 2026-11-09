import { Access } from '../auth/auth-policy.js';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PublicCartService } from './public-cart.service.js';

@Access('PUBLIC')
@Controller('public/cart')
export class PublicCartController {
  constructor(private readonly cart: PublicCartService) {}
  @Post('validate') @HttpCode(200)
  validate(@Body() body: unknown) { return this.cart.validate(body); }
}
