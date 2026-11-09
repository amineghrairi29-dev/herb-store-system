import { SelfAccountService } from './self-account.service.js';
import { Inject } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Access } from './auth-policy.js';
import { AuthService } from './auth.service.js';
import { cookieName, cookieOptions, sessionToken } from './auth-config.js';
import type { AuthRequest } from './auth.guard.js';
@Access('AUTH') @Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(SelfAccountService) private readonly account: SelfAccountService) {}
  @Access('PUBLIC_AUTH') @Post('login') @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    try { const result = await this.auth.login(body, sessionToken(request)); await AuditService.security('AUTH_LOGIN_SUCCESS', result.user); response.cookie(cookieName(), result.token, { ...cookieOptions(), expires: result.expiresAt }); return result.user; }
    catch (error: unknown) { if (error instanceof UnauthorizedException) await AuditService.security('AUTH_LOGIN_FAILURE', null); throw error; }
  }
  @Get('account/security') security(@Req() req: AuthRequest) { return this.account.security('ADMIN', req.user.id, sessionToken(req)); }
  @Patch('account/profile') profile(@Req() req: AuthRequest, @Body() body: unknown) { return this.account.profile(req.user.id, sessionToken(req), body); }
  @Patch('account/email') email(@Req() req: AuthRequest, @Body() body: unknown) { return this.account.change('ADMIN', req.user.id, sessionToken(req), 'email', body); }
  @Patch('account/password') password(@Req() req: AuthRequest, @Body() body: unknown) { return this.account.change('ADMIN', req.user.id, sessionToken(req), 'password', body); }
  @Get('me') me(@Req() request: AuthRequest) { return request.user; }
  @Access('PUBLIC_AUTH') @Post('logout') @HttpCode(200)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const actor = await this.auth.current(sessionToken(request)).catch(() => null);
    await this.auth.logout(sessionToken(request)); if (actor) await AuditService.security('AUTH_LOGOUT', actor); response.clearCookie(cookieName(), cookieOptions()); return { success: true };
  }
}
