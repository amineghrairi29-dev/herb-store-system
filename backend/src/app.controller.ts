import { Access } from './auth/auth-policy.js';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Access('SYSTEM')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
