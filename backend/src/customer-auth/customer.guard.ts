import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CustomerAuthService } from './customer-auth.service.js';
import { customerToken, type CustomerInfo } from './customer-config.js';
export type CustomerRequest = Request & { customer: CustomerInfo };
@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(
    @Inject(CustomerAuthService) private readonly auth: CustomerAuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    request.customer = await this.auth.current(customerToken(request));
    return true;
  }
}
