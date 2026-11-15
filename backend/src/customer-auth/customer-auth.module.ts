import { Module } from '@nestjs/common';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { GoogleAuthService } from './google-auth.service.js';
import { CustomerGuard, OptionalCustomerGuard } from './customer.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { UnifiedLoginService } from './unified-login.service.js';
import { UnifiedLoginController } from './unified-login.controller.js';
@Module({
  imports: [AuthModule],
  controllers: [CustomerAuthController, UnifiedLoginController],
  providers: [CustomerAuthService, GoogleAuthService, CustomerGuard, OptionalCustomerGuard, UnifiedLoginService],
  exports: [CustomerAuthService, CustomerGuard, OptionalCustomerGuard],
})
export class CustomerAuthModule {}
