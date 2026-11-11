import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CustomerAuthService } from './customer-auth.service.js';
import { customerToken, type CustomerInfo } from './customer-config.js';
export type CustomerRequest = Request & { customer: CustomerInfo };
export type OptionalCustomerRequest = Request & { customer: CustomerInfo | null };
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

/** Attaches the signed-in customer when there is one; visitors continue as guests. */
@Injectable()
export class OptionalCustomerGuard implements CanActivate {
  constructor(
    @Inject(CustomerAuthService) private readonly auth: CustomerAuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OptionalCustomerRequest>();
    const token = customerToken(request);
    request.customer = null;
    if (!token) return true;
    try {
      request.customer = await this.auth.current(token);
    } catch (error) {
      // An expired or foreign cookie must not block a guest order.
      if (!(error instanceof UnauthorizedException)) throw error;
    }
    return true;
  }
}
