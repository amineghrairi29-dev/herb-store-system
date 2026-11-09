import { Body, Controller, HttpCode, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Access } from '../auth/auth-policy.js';
import { cookieName, cookieOptions, sessionToken } from '../auth/auth-config.js';
import { AuditService } from '../audit/audit.service.js';
import { customerCookie, customerToken, safeReturn } from './customer-config.js';
import { UnifiedLoginService } from './unified-login.service.js';

@Access('PUBLIC_AUTH')
@Controller('public/auth')
export class UnifiedLoginController {
  constructor(@Inject(UnifiedLoginService) private readonly auth: UnifiedLoginService) {}

  @Post('sign-in')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.login(body, sessionToken(req), customerToken(req));
      if (result.kind === 'ADMIN') await AuditService.security('AUTH_LOGIN_SUCCESS', result.user);
      res.cookie(result.kind === 'ADMIN' ? cookieName() : customerCookie(), result.token, {
        ...cookieOptions(), expires: result.expiresAt,
      });
      const returnTo = body && typeof body === 'object' && 'returnTo' in body ? body.returnTo : undefined;
      // The client follows a server-selected allowlisted destination, never a supplied role.
      return { redirectTo: result.kind === 'ADMIN' ? '/dashboard' : safeReturn(returnTo) };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) await AuditService.security('AUTH_LOGIN_FAILURE', null);
      throw error;
    }
  }
}
