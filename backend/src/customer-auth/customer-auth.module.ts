import { Module } from '@nestjs/common';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { GoogleAuthService } from './google-auth.service.js';
import { CustomerGuard } from './customer.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { UnifiedLoginService } from './unified-login.service.js';
import { UnifiedLoginController } from './unified-login.controller.js';
@Module({
  imports: [AuthModule],
  controllers: [CustomerAuthController, UnifiedLoginController],
  providers: [CustomerAuthService, GoogleAuthService, CustomerGuard, UnifiedLoginService],
  exports: [CustomerAuthService, CustomerGuard],
})
export class CustomerAuthModule {}
