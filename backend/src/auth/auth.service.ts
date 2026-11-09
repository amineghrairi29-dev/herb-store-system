import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { safeUser } from './auth-policy.js';
import { sessionMilliseconds } from './auth-config.js';
const dummyHash = hash(randomBytes(32).toString('hex'), 12);
// Opaque sessions are unchanged. Configuring/rotating the key invalidates old sessions.
// The unkeyed branch preserves existing local development sessions only.
export const tokenHash = (token: string) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is required in production.');
  return (secret ? createHmac('sha256', secret) : createHash('sha256')).update(token).digest('hex');
};
@Injectable()
export class AuthService {
  async localAdmin() {
    return withPurchaseTransaction(async tx => {
      const result = await tx.client.query<{ id: number; email: string; fullName: string; role: string }>(
        'SELECT id, email, "fullName", role FROM public."user" WHERE role = $1 AND "isActive" = true ORDER BY id LIMIT 1', ['ADMIN'],
      );
      if (!result.rows[0]) throw new UnauthorizedException('Aucun ADMIN actif pour le mode de développement.');
      return safeUser(result.rows[0]);
    }, true);
  }
  async login(body: unknown, previous?: string) {
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const email = typeof input.email === 'string' && input.email.length <= 254 ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' && Buffer.byteLength(input.password) <= 72 ? input.password : '';
    return withPurchaseTransaction(async tx => {
      const result = await tx.client.query<{ id: number; email: string; fullName: string; role: string; passwordHash: string; isActive: boolean }>('SELECT * FROM public."user" WHERE email = $1 FOR UPDATE', [email]);
      const user = result.rows[0]; const valid = await compare(password, user?.passwordHash ?? await dummyHash);
      if (!user || !valid || !user.isActive || user.role !== 'ADMIN' || !password) throw new UnauthorizedException('Email ou mot de passe incorrect.');
      const token = randomBytes(32).toString('base64url'), expiresAt = new Date(Date.now() + sessionMilliseconds());
      if (previous) await tx.client.query('DELETE FROM public."authSession" WHERE "tokenHash" = $1', [tokenHash(previous)]);
      await tx.client.query('DELETE FROM public."authSession" WHERE "userId" = $1 AND "expiresAt" <= now()', [user.id]);
      await tx.orm.public.AuthSession.create({ userId: user.id, tokenHash: tokenHash(token), expiresAt: expiresAt.toISOString() });
      await tx.orm.public.User.where({ id: user.id }).update({ lastLoginAt: new Date().toISOString() });
      return { user: safeUser(user), token, expiresAt };
    });
  }
  async current(token?: string) {
    if (!token) throw new UnauthorizedException('Authentification requise.');
    return withPurchaseTransaction(async tx => {
      const result = await tx.client.query<{ id: number; email: string; fullName: string; role: string }>('SELECT u.id, u.email, u."fullName", u.role FROM public."authSession" s JOIN public."user" u ON u.id = s."userId" WHERE s."tokenHash" = $1 AND s."expiresAt" > now() AND u."isActive" = true', [tokenHash(token)]);
      if (!result.rows[0] || result.rows[0].role !== 'ADMIN') throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.'); return safeUser(result.rows[0]);
    }, true);
  }
  async logout(token?: string) {
    if (token) await withPurchaseTransaction(async tx => { await tx.client.query('DELETE FROM public."authSession" WHERE "tokenHash" = $1', [tokenHash(token)]); });
  }
}
