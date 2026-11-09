import { SelfAccountService } from '../auth/self-account.service.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Access } from '../auth/auth-policy.js';
import { cookieOptions, frontendOrigin } from '../auth/auth-config.js';
import { CustomerAuthService } from './customer-auth.service.js';
import {
  customerCookie,
  customerToken,
  googleCookie,
  readCookie,
} from './customer-config.js';
import { CustomerGuard, type CustomerRequest } from './customer.guard.js';
import { GoogleAuthService } from './google-auth.service.js';
@Access('PUBLIC_AUTH')
@Controller('public/auth')
export class CustomerAuthController {
  constructor(
    @Inject(CustomerAuthService) private readonly auth: CustomerAuthService,
    @Inject(GoogleAuthService) private readonly google: GoogleAuthService,
    @Inject(SelfAccountService) private readonly account: SelfAccountService,
  ) {}
  private setSession(
    response: Response,
    result: Awaited<ReturnType<CustomerAuthService['login']>>,
  ) {
    response.cookie(customerCookie(), result.token, {
      ...cookieOptions(),
      expires: result.expiresAt,
    });
    return result.customer;
  }
  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setSession(
      res,
      await this.auth.register(body, customerToken(req)),
    );
  }
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setSession(
      res,
      await this.auth.login(body, customerToken(req)),
    );
  }
  @Get('me')
  @UseGuards(CustomerGuard)
  me(@Req() req: CustomerRequest) {
    return req.customer;
  }
  @Get('security') @UseGuards(CustomerGuard)
  security(@Req() req: CustomerRequest) { return this.account.security('CUSTOMER', req.customer.id, customerToken(req)); }
  @Patch('email') @UseGuards(CustomerGuard)
  email(@Req() req: CustomerRequest, @Body() body: unknown) { return this.account.change('CUSTOMER', req.customer.id, customerToken(req), 'email', body); }
  @Patch('password') @UseGuards(CustomerGuard)
  password(@Req() req: CustomerRequest, @Body() body: unknown) { return this.account.change('CUSTOMER', req.customer.id, customerToken(req), 'password', body); }
  @Patch('profile')
  @UseGuards(CustomerGuard)
  profile(@Req() req: CustomerRequest, @Body() body: unknown) {
    return this.auth.updateProfile(req.customer.id, body);
  }
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(customerToken(req));
    res.clearCookie(customerCookie(), cookieOptions());
    return { success: true };
  }
  @Get('config') config() {
    return { googleEnabled: this.google.enabled() };
  }
  @Get('google/start')
  async start(@Query('returnTo') returnTo: unknown, @Res() res: Response, @Query('entry') entry: unknown) {
    const flow = await this.google.start(entry === 'true' ? '/shop' : returnTo, entry === 'true');
    res.cookie(googleCookie(), flow.cookie, {
      ...cookieOptions(),
      maxAge: 600000,
    });
    res.redirect(flow.url);
  }
  @Get('google/callback')
  async callback(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.clearCookie(googleCookie(), cookieOptions());
    let returnTo = '/shop';
    let authPath = '/shop/auth';
    try {
      const flow = this.google.readFlow(readCookie(req, googleCookie()), state);
      returnTo = flow.returnTo;
      if (flow.entry) authPath = '/auth';
      const identity = await this.google.finish(code, flow);
      this.setSession(
        res,
        await this.auth.google(identity, customerToken(req)),
      );
      res.redirect(frontendOrigin() + returnTo);
    } catch {
      // Never serialize provider errors, codes, tokens or profile details into a URL/log.
      res.redirect(
        frontendOrigin() +
          authPath + '?' +
          new URLSearchParams({ returnTo, error: 'google' }),
      );
    }
  }
}
