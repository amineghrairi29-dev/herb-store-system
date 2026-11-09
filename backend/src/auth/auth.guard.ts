import { Inject } from '@nestjs/common';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { ACCESS, allowed, type Permission, type SafeUser } from './auth-policy.js';
import { frontendOrigin, sessionToken } from './auth-config.js';
import { AuthService } from './auth.service.js';
import { devAdminBypass } from './dev-admin-bypass.js';
export type AuthRequest = Request & { user: SafeUser };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<Permission>(ACCESS, [context.getHandler(), context.getClass()]);
    if (permission === 'PUBLIC') return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    if (permission !== 'PUBLIC_AUTH') request.user = devAdminBypass(request)
      ? await this.auth.localAdmin()
      : await this.auth.current(sessionToken(request));
    // Cookies are ambient credentials: unsafe requests require our exact trusted origin.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== frontendOrigin()) throw new ForbiddenException('Origine de la requête non autorisée.');
    if (permission === 'PUBLIC_AUTH') return true;
    if (!permission || !allowed(request.user.role, permission, request.method)) throw new ForbiddenException('Accès non autorisé pour votre rôle.'); return true;
  }
}
