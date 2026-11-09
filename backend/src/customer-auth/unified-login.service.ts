import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service.js';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { CustomerAuthService } from './customer-auth.service.js';

const dummy = hash(randomBytes(32).toString('hex'), 12);
@Injectable()
export class UnifiedLoginService {
  constructor(
    @Inject(AuthService) private readonly admin: AuthService,
    @Inject(CustomerAuthService) private readonly customer: CustomerAuthService,
  ) {}

  async login(body: unknown, adminToken?: string, customerToken?: string) {
    const data = body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown> : {};
    const email = typeof data.email === 'string' && data.email.length <= 254
      ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' && Buffer.byteLength(data.password) <= 72
      ? data.password : '';
    // Include inactive/obsolete identities: never silently choose between accounts.
    const identities = await withPurchaseTransaction(async tx => (
      await tx.client.query<{ kind: 'ADMIN' | 'CUSTOMER' }>(
        `SELECT 'ADMIN' AS kind FROM public."user" WHERE lower(trim(email))=$1
         UNION ALL SELECT 'CUSTOMER' AS kind FROM public.customer WHERE lower(trim(email))=$1`, [email],
      )
    ).rows, true);
    if (!email || !password || Object.keys(data).some(key => !['email', 'password', 'returnTo'].includes(key)) || identities.length !== 1) {
      await compare(password, await dummy);
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }
    const credentials = { email, password };
    if (identities[0].kind === 'ADMIN') {
      return { kind: 'ADMIN' as const, ...await this.admin.login(credentials, adminToken) };
    }
    return { kind: 'CUSTOMER' as const, ...await this.customer.login(credentials, customerToken) };
  }
}
