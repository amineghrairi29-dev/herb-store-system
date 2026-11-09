import { availableEmail, lockIdentityEmails } from '../auth/identity-email.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import {
  withPurchaseTransaction as transaction,
  type PurchaseTransaction,
} from '../purchases/purchase-transaction.js';
import { tokenHash } from '../auth/auth.service.js';
import { sessionMilliseconds } from '../auth/auth-config.js';
import type { CustomerInfo } from './customer-config.js';

interface CustomerRow extends CustomerInfo {
  passwordHash: string | null;
  googleSubject: string | null;
  isActive: boolean;
}
export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  authoritative: boolean;
}
const dummy = hash(randomBytes(32).toString('hex'), 12);
const denied = () =>
  new UnauthorizedException('Email ou mot de passe incorrect.');
const safe = (c: CustomerInfo): CustomerInfo => ({
  id: c.id,
  email: c.email,
  fullName: c.fullName,
  phone: c.phone,
  deliveryAddress: c.deliveryAddress ?? null,
});
function input(body: unknown, keys: string[]) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !keys.includes(k))
  )
    throw new BadRequestException('Données invalides.');
  return body as Record<string, unknown>;
}
function emailValue(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new BadRequestException('Email invalide.');
  return value.trim().toLowerCase();
}
@Injectable()
export class CustomerAuthService {
  async updateProfile(customerId: number, body: unknown) {
    const data = input(body, ['fullName', 'phone', 'deliveryAddress']);
    const text = (key: string, max: number, required = false) => {
      const value = data[key];
      if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
        throw new BadRequestException('Nom requis ; téléphone (40 caractères) et adresse (500 caractères) invalides.');
      return value.trim() || null;
    };
    const fullName = text('fullName', 150, true), phone = text('phone', 40), address = text('deliveryAddress', 500);
    return transaction(async tx => {
      const result = await tx.client.query<CustomerInfo>('UPDATE public.customer SET "fullName"=$1, phone=$2, "deliveryAddress"=$3, "updatedAt"=now() WHERE id=$4 AND "isActive"=true RETURNING id,email,"fullName",phone,"deliveryAddress"', [fullName, phone, address, customerId]);
      if (!result.rows[0]) throw new UnauthorizedException('Session expirée.');
      return safe(result.rows[0]);
    });
  }
  private async session(
    tx: PurchaseTransaction,
    customer: CustomerRow,
    previous?: string,
  ) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionMilliseconds());
    if (previous)
      await tx.client.query(
        'DELETE FROM public."customerSession" WHERE "tokenHash"=$1',
        [tokenHash('customer:' + previous)],
      );
    await tx.client.query(
      'DELETE FROM public."customerSession" WHERE "customerId"=$1 AND "expiresAt" <= now()',
      [customer.id],
    );
    await tx.client.query(
      'INSERT INTO public."customerSession" ("customerId", "tokenHash", "expiresAt") VALUES ($1,$2,$3)',
      [customer.id, tokenHash('customer:' + token), expiresAt],
    );
    await tx.client.query(
      'UPDATE public.customer SET "lastLoginAt"=now(), "updatedAt"=now() WHERE id=$1',
      [customer.id],
    );
    return { customer: safe(customer), token, expiresAt };
  }
  async register(body: unknown, previous?: string) {
    const data = input(body, ['email', 'password', 'fullName', 'phone']);
    const email = emailValue(data.email),
      password = data.password;
    if (
      typeof password !== 'string' ||
      password.length < 8 ||
      Buffer.byteLength(password) > 72 ||
      !/[a-zA-Z]/.test(password) ||
      !/[0-9]/.test(password)
    )
      throw new BadRequestException(
        'Mot de passe : au moins 8 caractères, une lettre et un chiffre (72 octets maximum).',
      );
    const text = (key: string, max: number) => {
      const v = data[key];
      if (v === undefined || v === null) return null;
      if (typeof v !== 'string' || v.length > max)
        throw new BadRequestException('Coordonnées invalides.');
      return v.trim() || null;
    };
    const fullName = text('fullName', 150),
      phone = text('phone', 40),
      passwordHash = await hash(password, 12);
    return transaction(async (tx) => {
      await lockIdentityEmails(tx);
      await availableEmail(tx, email);
      const result = await tx.client.query<CustomerRow>(
        'INSERT INTO public.customer (email,"passwordHash","fullName",phone,"updatedAt") VALUES ($1,$2,$3,$4,now()) ON CONFLICT (email) DO NOTHING RETURNING *',
        [email, passwordHash, fullName, phone],
      );
      if (!result.rows[0])
        throw new ConflictException(
          'Impossible de créer ce compte. Essayez de vous connecter.',
        );
      return this.session(tx, result.rows[0], previous);
    });
  }
  async login(body: unknown, previous?: string) {
    const data = input(body, ['email', 'password']);
    const email =
      typeof data.email === 'string' && data.email.length <= 254
        ? data.email.trim().toLowerCase()
        : '';
    const password =
      typeof data.password === 'string' &&
      Buffer.byteLength(data.password) <= 72
        ? data.password
        : '';
    return transaction(async (tx) => {
      const c = (
        await tx.client.query<CustomerRow>(
          'SELECT * FROM public.customer WHERE email=$1 FOR UPDATE',
          [email],
        )
      ).rows[0];
      const valid = await compare(password, c?.passwordHash ?? (await dummy));
      if (!c || !c.passwordHash || !c.isActive || !password || !valid)
        throw denied();
      return this.session(tx, c, previous);
    });
  }
  async current(token?: string): Promise<CustomerInfo> {
    if (!token)
      throw new UnauthorizedException(
        'Identifiez-vous pour finaliser votre commande.',
      );
    return transaction(async (tx) => {
      const c = (
        await tx.client.query<CustomerInfo>(
          'SELECT c.id,c.email,c."fullName",c.phone,c."deliveryAddress" FROM public.customer c JOIN public."customerSession" s ON s."customerId"=c.id WHERE s."tokenHash"=$1 AND s."expiresAt">now() AND c."isActive"=true',
          [tokenHash('customer:' + token)],
        )
      ).rows[0];
      if (!c)
        throw new UnauthorizedException(
          'Session expirée. Veuillez vous reconnecter.',
        );
      return safe(c);
    }, true);
  }
  async logout(token?: string) {
    if (token)
      await transaction(async (tx) => {
        await tx.client.query(
          'DELETE FROM public."customerSession" WHERE "tokenHash"=$1',
          [tokenHash('customer:' + token)],
        );
      });
  }
  // Called only with a server-verified provider identity, never raw request profile data.
  async google(identity: GoogleIdentity, previous?: string) {
    const email = emailValue(identity.email);
    return transaction(async (tx) => {
      await lockIdentityEmails(tx);
      // Serialize same-email sign-ins and let unique constraints arbitrate registration races.
      await tx.client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'customer-google:' + email,
      ]);
      let c = (
        await tx.client.query<CustomerRow>(
          'SELECT * FROM public.customer WHERE "googleSubject"=$1 OR email=$2 ORDER BY "googleSubject" NULLS LAST FOR UPDATE',
          [identity.sub, email],
        )
      ).rows[0];
      await availableEmail(tx, email, 'CUSTOMER', c?.id);
      if (c) {
        if (
          !c.isActive ||
          (c.googleSubject && c.googleSubject !== identity.sub)
        )
          throw denied();
        if (!c.googleSubject) {
          // Google cannot attest continued ownership of arbitrary third-party email addresses.
          if (!identity.authoritative)
            throw new ConflictException(
              'Connectez-vous avec votre mot de passe pour cette adresse.',
            );
          // Prevent pre-hijacking: revoke old sessions and remove the unverified local password.
          await tx.client.query(
            'UPDATE public.customer SET "googleSubject"=$1,"passwordHash"=NULL,"updatedAt"=now() WHERE id=$2',
            [identity.sub, c.id],
          );
          await tx.client.query(
            'DELETE FROM public."customerSession" WHERE "customerId"=$1',
            [c.id],
          );
        }
      } else {
        c = (
          await tx.client.query<CustomerRow>(
            'INSERT INTO public.customer (email,"googleSubject","fullName","updatedAt") VALUES ($1,$2,$3,now()) ON CONFLICT DO NOTHING RETURNING *',
            [email, identity.sub, identity.name?.slice(0, 150) || null],
          )
        ).rows[0];
        if (!c) throw new ConflictException('Veuillez réessayer la connexion.');
      }
      return this.session(tx, c, previous);
    });
  }
}
