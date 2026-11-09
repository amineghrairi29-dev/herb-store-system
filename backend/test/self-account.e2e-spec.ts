import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { compare } from 'bcryptjs';
import { AuthModule } from '../src/auth/auth.module.js';
import { CustomerAuthModule } from '../src/customer-auth/customer-auth.module.js';
import { UsersService } from '../src/auth/users.service.js';
import { CustomerAuthService } from '../src/customer-auth/customer-auth.service.js';
import { SelfAccountService } from '../src/auth/self-account.service.js';
import { configureHttpSecurity } from '../src/auth/http-security.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Self-service accounts (isolated fixtures)', () => {
  const tag = 'self-account-' + crypto.randomUUID(), password = 'Aa9-' + crypto.randomUUID(), next = 'Bb8-' + crypto.randomUUID();
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication<App>;
  const accounts = {
    ADMIN: { email: tag + '-admin@example.test', id: 0, cookie: '', prefix: '/auth/account', me: '/auth/me', table: '"user"' },
    CUSTOMER: { email: tag + '-customer@example.test', id: 0, cookie: '', prefix: '/public/auth', me: '/public/auth/me', table: 'customer' },
  };
  const post = (path: string) => request(app.getHttpServer()).post(path).set('Origin', 'http://localhost:3000');
  const patch = (path: string, cookie: string) => request(app.getHttpServer()).patch(path).set('Origin', 'http://localhost:3000').set('Cookie', cookie);
  const get = (path: string, cookie: string) => request(app.getHttpServer()).get(path).set('Cookie', cookie);
  const cookieOf = (r: { headers: Record<string, unknown> }) => String((r.headers['set-cookie'] as string[])[0]).split(';')[0];
  const login = (email: string, pass = password) => post('/public/auth/sign-in').send({ email, password: pass });
  beforeAll(async () => {
    vi.stubEnv('DEV_ADMIN_BYPASS', 'false');
    const mod = await Test.createTestingModule({ imports: [AuthModule, CustomerAuthModule] }).compile();
    app = mod.createNestApplication(); app.useLogger(false); configureHttpSecurity(app); await app.init(); await db.connect();
    const admin = await new UsersService().create({ email: accounts.ADMIN.email, fullName: tag, password, role: 'ADMIN', isActive: true });
    if (!('id' in admin)) throw new Error('Fixture creation failed'); accounts.ADMIN.id = admin.id;
    const customer = await post('/public/auth/register').send({ email: accounts.CUSTOMER.email, password }).expect(201);
    accounts.CUSTOMER.id = customer.body.id;
    for (const account of Object.values(accounts)) account.cookie = cookieOf(await login(account.email).expect(200));
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await db.query('DELETE FROM public.customer WHERE email LIKE $1', [tag + '%']);
    await db.query('DELETE FROM public."user" WHERE email LIKE $1', [tag + '%']);
    await db.end(); vi.unstubAllEnvs();
  });
  it('keeps session types isolated and rejects account-id/role injection', async () => {
    await get('/auth/account/security', accounts.CUSTOMER.cookie).expect(401);
    await get('/public/auth/security', accounts.ADMIN.cookie).expect(401);
    for (const account of Object.values(accounts)) {
      const response = await get(account.prefix + '/security', account.cookie).expect(200); expect(response.body).toEqual({ hasPassword: true });
      await patch(account.prefix + '/profile', account.cookie).send({ fullName: 'Changed', id: 39, role: 'ADMIN' }).expect(400);
    }
  });
  it.each(['ADMIN', 'CUSTOMER'] as const)('%s profile and email update are scoped to the session', async kind => {
    const account = accounts[kind], other = accounts[kind === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'];
    const otherBefore = (await db.query(`SELECT * FROM public.${other.table} WHERE id=$1`, [other.id])).rows[0];
    await patch(account.prefix + '/profile', account.cookie).send({ fullName: 'عميل Test', ...(kind === 'CUSTOMER' ? { phone: '20987654', deliveryAddress: '12 rue des Plantes' } : {}) }).expect(200);
    const me = await get(account.me, account.cookie).expect(200); expect(me.body.fullName).toBe('عميل Test');
    if (kind === 'CUSTOMER') expect(me.body.deliveryAddress).toBe('12 rue des Plantes');
    const spare = cookieOf(await login(account.email).expect(200));
    const duplicate = await patch(account.prefix + '/email', account.cookie).send({ email: other.email.toUpperCase(), currentPassword: password }).expect(409);
    expect(duplicate.body.message).toBe('Modification impossible. Vérifiez les informations saisies.');
    const newEmail = tag + '-' + kind.toLowerCase() + '-changed@example.test';
    await patch(account.prefix + '/email', account.cookie).send({ email: newEmail, currentPassword: 'wrong' }).expect(400);
    await patch(account.prefix + '/email', account.cookie).send({ email: ' ' + newEmail.toUpperCase() + ' ', currentPassword: password }).expect(200);
    const updated = await get(account.me, account.cookie).expect(200); expect(updated.body.email).toBe(newEmail);
    await get(account.me, spare).expect(401);
    await login(account.email).expect(401);
    account.email = newEmail;
    await login(newEmail).expect(200);
    expect((await db.query(`SELECT * FROM public.${other.table} WHERE id=$1`, [other.id])).rows[0]).toEqual(otherBefore);
  });
  it.each(['ADMIN', 'CUSTOMER'] as const)('%s password change retains only current session', async kind => {
    const account = accounts[kind], spare = cookieOf(await login(account.email).expect(200));
    await patch(account.prefix + '/password', account.cookie).send({ currentPassword: password, newPassword: next, confirmPassword: 'mismatch' }).expect(400);
    await patch(account.prefix + '/password', account.cookie).send({ currentPassword: password, newPassword: next, confirmPassword: next }).expect(200);
    await get(account.me, account.cookie).expect(200); await get(account.me, spare).expect(401);
    const row = (await db.query(`SELECT "passwordHash" FROM public.${account.table} WHERE id=$1`, [account.id])).rows[0];
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/); expect(await compare(next, row.passwordHash)).toBe(true);
    await login(account.email, password).expect(401); await login(account.email, next).expect(200);
  });
  it('serializes concurrent cross-identity email claims and registration', async () => {
    const shared = tag + '-race@example.test';
    const results = await Promise.all(Object.values(accounts).map(a => patch(a.prefix + '/email', a.cookie).send({ email: shared, currentPassword: next })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    await expect(app.get(CustomerAuthService).register({ email: shared, password })).rejects.toThrow();
    await expect(new UsersService().create({ email: shared, fullName: 'Duplicate', role: 'ADMIN', password })).rejects.toThrow();
  });
  it('fails closed for Google-only accounts and revoked tokens', async () => {
    const customer = await app.get(CustomerAuthService).google({ sub: tag, email: tag + '-google@example.test', authoritative: true });
    const service = app.get(SelfAccountService);
    expect(await service.security('CUSTOMER', customer.customer.id, customer.token)).toEqual({ hasPassword: false });
    await expect(service.change('CUSTOMER', customer.customer.id, customer.token, 'password', { currentPassword: password, newPassword: next, confirmPassword: next })).rejects.toThrow();
    await app.get(CustomerAuthService).logout(customer.token);
    await expect(service.change('CUSTOMER', customer.customer.id, customer.token, 'email', { email: tag + '-unused@example.test', currentPassword: password })).rejects.toThrow();
  });
  it('rejects password confirmation, privilege injection and concurrent stale sessions', async () => {
    const customerAuth = app.get(CustomerAuthService), service = app.get(SelfAccountService);
    const email = tag + '-concurrent@example.test';
    const first = await customerAuth.register({ email, password });
    const second = await customerAuth.login({ email, password });
    const body = { currentPassword: password, newPassword: next, confirmPassword: next };
    await expect(service.change('CUSTOMER', first.customer.id, first.token, 'password', { ...body, currentPassword: 'wrong' })).rejects.toThrow();
    await expect(service.change('CUSTOMER', first.customer.id, first.token, 'password', { ...body, role: 'ADMIN' })).rejects.toThrow();
    const results = await Promise.allSettled([first, second].map(session => service.change('CUSTOMER', session.customer.id, session.token, 'password', body)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const internal = (await db.query<{ email: string }>('SELECT email FROM public."user" WHERE id=$1', [accounts.ADMIN.id])).rows[0];
    await expect(customerAuth.google({ sub: tag + '-conflict', email: internal.email, authoritative: true })).rejects.toThrow();
  });
});
