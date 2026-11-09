import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { AuthModule } from '../src/auth/auth.module.js';
import { CustomerAuthModule } from '../src/customer-auth/customer-auth.module.js';
import { UsersService } from '../src/auth/users.service.js';
import { configureHttpSecurity } from '../src/auth/http-security.js';
import { GoogleAuthService } from '../src/customer-auth/google-auth.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Unified login with isolated identity fixtures', () => {
  const tag = 'unified-' + crypto.randomUUID();
  const adminEmail = tag + '-admin@example.test', customerEmail = tag + '-customer@example.test';
  const password = 'Aa9-' + crypto.randomUUID();
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication<App>;
  const post = (path: string) => request(app.getHttpServer()).post(path).set('Origin', 'http://localhost:3000');
  const cookie = (response: { headers: Record<string, unknown> }) => String((response.headers['set-cookie'] as string[])[0]).split(';')[0];
  beforeAll(async () => {
    vi.stubEnv('DEV_ADMIN_BYPASS', 'false');
    const module = await Test.createTestingModule({ imports: [AuthModule, CustomerAuthModule] }).compile();
    app = module.createNestApplication(); app.useLogger(false); configureHttpSecurity(app); await app.init();
    await db.connect();
    await new UsersService().create({ email: adminEmail, fullName: tag, role: 'ADMIN', isActive: true, password });
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await db.query('DELETE FROM public.customer WHERE email LIKE $1', [tag + '%']);
    await db.query('DELETE FROM public."user" WHERE email LIKE $1', [tag + '%']);
    await db.end(); vi.restoreAllMocks(); vi.unstubAllEnvs();
  });
  it('registers only customers; rejects role injection', async () => {
    await post('/public/auth/register').send({ email: customerEmail, password, role: 'ADMIN' }).expect(400);
    const response = await post('/public/auth/register').send({ email: customerEmail, password }).expect(201);
    expect(cookie(response)).toMatch(/^herb_customer=/);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie(response)).expect(401);
  });
  it('normalizes ADMIN login, selects dashboard, rotates and revokes only admin sessions', async () => {
    const first = await post('/public/auth/sign-in').send({ email: ` ${adminEmail.toUpperCase()} `, password, returnTo: '/shop/checkout' }).expect(200);
    expect(first.body).toEqual({ redirectTo: '/dashboard' }); expect(cookie(first)).toMatch(/^herb_session=/);
    expect(String(first.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(first.headers['set-cookie'])).toContain('SameSite=Lax');
    const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie(first)).expect(200);
    expect(me.body.role).toBe('ADMIN');
    await request(app.getHttpServer()).get('/users').set('Cookie', cookie(first)).expect(200);
    await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', cookie(first)).expect(401);
    const second = await post('/public/auth/sign-in').set('Cookie', cookie(first)).send({ email: adminEmail, password }).expect(200);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie(first)).expect(401);
    await post('/auth/logout').set('Cookie', cookie(second)).expect(200);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie(second)).expect(401);
  });
  it('keeps customer destination, guards and logout separate', async () => {
    const entry = await post('/public/auth/sign-in').send({ email: customerEmail, password, returnTo: '/shop' }).expect(200);
    expect(entry.body).toEqual({ redirectTo: '/shop' });
    const response = await post('/public/auth/sign-in').send({ email: customerEmail, password, returnTo: '/shop/checkout' }).expect(200);
    expect(response.body).toEqual({ redirectTo: '/shop/checkout' }); expect(cookie(response)).toMatch(/^herb_customer=/);
    await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', cookie(response)).expect(200);
    await request(app.getHttpServer()).get('/users').set('Cookie', cookie(response)).expect(401);
    const next = await post('/public/auth/sign-in').set('Cookie', cookie(response)).send({ email: customerEmail, password, returnTo: 'https://evil.test' }).expect(200);
    expect(next.body).toEqual({ redirectTo: '/shop' });
    await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', cookie(response)).expect(401);
    await post('/public/auth/logout').set('Cookie', cookie(next)).expect(200);
    await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', cookie(next)).expect(401);
  });
  it('rejects wrong, unknown, inactive and ambiguous credentials identically', async () => {
    const wrong = await post('/public/auth/sign-in').send({ email: adminEmail, password: 'Incorrect9!' }).expect(401);
    const unknown = await post('/public/auth/sign-in').send({ email: tag + '-none@example.test', password }).expect(401);
    await db.query('UPDATE public.customer SET "isActive"=false WHERE email=$1', [customerEmail]);
    const inactive = await post('/public/auth/sign-in').send({ email: customerEmail, password }).expect(401);
    // New collisions are refused; manually model a legacy collision in this isolated fixture.
    await post('/public/auth/register').send({ email: adminEmail, password }).expect(409);
    await db.query('INSERT INTO public.customer (email,"passwordHash","updatedAt") SELECT email,"passwordHash",now() FROM public."user" WHERE email=$1', [adminEmail]);
    const ambiguous = await post('/public/auth/sign-in').send({ email: adminEmail, password }).expect(401);
    for (const result of [unknown, inactive, ambiguous]) { expect(result.body).toEqual(wrong.body); expect(result.headers['set-cookie']).toBeUndefined(); }
    await db.query('DELETE FROM public.customer WHERE email=$1', [adminEmail]);
  });
  it('keeps verified Google callback customer-only', async () => {
    const google = app.get(GoogleAuthService);
    vi.spyOn(google, 'readFlow').mockReturnValue({ returnTo: '/shop/checkout' } as ReturnType<GoogleAuthService['readFlow']>);
    vi.spyOn(google, 'finish').mockResolvedValue({ sub: tag, email: tag + '-google@example.test', authoritative: true });
    const response = await request(app.getHttpServer()).get('/public/auth/google/callback?code=test&state=test').expect(302);
    expect(response.headers.location).toBe('http://localhost:3000/shop/checkout');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const customer = cookies.find(value => value.startsWith('herb_customer='))!.split(';')[0];
    expect(cookies.some(value => value.startsWith('herb_session='))).toBe(false);
    await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', customer).expect(200);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', customer).expect(401);
  });
  it('returns Google entry success to shop and entry failure to /auth', async () => {
    const google = app.get(GoogleAuthService);
    vi.spyOn(google, 'readFlow').mockReturnValue({ returnTo: '/shop', entry: true } as ReturnType<GoogleAuthService['readFlow']>);
    const success = await request(app.getHttpServer()).get('/public/auth/google/callback?code=test&state=test').expect(302);
    expect(success.headers.location).toBe('http://localhost:3000/shop');
    vi.spyOn(google, 'finish').mockRejectedValueOnce(new Error('Provider denied'));
    const failure = await request(app.getHttpServer()).get('/public/auth/google/callback?code=test&state=test').expect(302);
    expect(failure.headers.location).toBe('http://localhost:3000/auth?returnTo=%2Fshop&error=google');
  });
  it('requires trusted origin and shares the existing admin failed-attempt limit', async () => {
    await request(app.getHttpServer()).post('/public/auth/sign-in').send({ email: customerEmail, password }).expect(403);
    for (let i = 0; i < 10; i++) {
      const result = await post('/public/auth/sign-in').send({ email: tag + '-none@example.test', password });
      if (result.status === 429) return;
      expect(result.status).toBe(401);
    }
    throw new Error('Expected login throttle');
  });
});
