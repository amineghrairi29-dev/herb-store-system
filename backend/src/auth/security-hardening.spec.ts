import { randomBytes, createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { Body, Controller, Get, Post, BadRequestException, InternalServerErrorException, Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { validateEnvironment } from './environment.js';
import { configureHttpSecurity } from './http-security.js';
import { cookieOptions, cookieName, sessionMilliseconds } from './auth-config.js';
import { tokenHash } from './auth.service.js';
import { assertInputBounds } from './input-bounds.pipe.js';

@Controller()
class ProbeController {
  @Get('probe') probe() { return { ok: true }; }
  @Post('probe') mutation() { throw new BadRequestException('Quantité invalide.'); }
  @Get('failure') failure() { throw new Error('SQL passwordHash /private/path secret-value'); }
  @Get('http-failure') httpFailure() { throw new InternalServerErrorException('Prisma SQL secret-value'); }
  @Post('bounded') bounded(@Body() body: unknown) { return body; }
}
describe('Security hardening configuration and HTTP boundary', () => {
  let app: INestApplication;
  const secret = randomBytes(32).toString('hex');
  afterEach(async () => { await app?.close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  const production = () => ({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://fixture:unused@localhost/fixture', AUTH_SECRET: secret, FRONTEND_ORIGIN: 'https://store.example.test' });
  it.each(['DATABASE_URL', 'AUTH_SECRET', 'FRONTEND_ORIGIN'])('rejects missing production %s', key => {
    expect(() => validateEnvironment({ ...production(), [key]: '' })).toThrow(key);
  });
  it.each(['short', 'a'.repeat(64), 'change-me-please-this-is-only-an-example-secret'])('rejects weak/example production keys', key => {
    expect(() => validateEnvironment({ ...production(), AUTH_SECRET: key })).toThrow('AUTH_SECRET');
  });
  it('validates origins, PostgreSQL URL and duration without exposing values', () => {
    expect(() => validateEnvironment(production())).not.toThrow();
    for (const origin of ['*', 'null', 'https://store.example.test/', 'http://store.example.test', 'ftp://store.example.test']) expect(() => validateEnvironment({ ...production(), FRONTEND_ORIGIN: origin })).toThrow('FRONTEND_ORIGIN');
    expect(() => validateEnvironment({ ...production(), DATABASE_URL: 'https://private-secret.invalid' })).toThrow('DATABASE_URL');
    expect(() => validateEnvironment({ ...production(), AUTH_SESSION_HOURS: '169' })).toThrow('AUTH_SESSION_HOURS');
  });
  it('uses bounded host-only production cookies; keyed hashes change on rotation without storing tokens', () => {
    for (const [key, value] of Object.entries(production())) vi.stubEnv(key, value);
    expect(cookieName()).toBe('__Host-herb_session');
    expect(cookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(sessionMilliseconds()).toBeGreaterThan(0);
    const token = randomBytes(32).toString('base64url'), first = tokenHash(token);
    expect(first).toMatch(/^[a-f0-9]{64}$/); expect(first).not.toBe(createHash('sha256').update(token).digest('hex'));
    vi.stubEnv('AUTH_SECRET', randomBytes(32).toString('hex')); expect(tokenHash(token)).not.toBe(first);
    vi.stubEnv('AUTH_SECRET', ''); expect(() => tokenHash(token)).toThrow('AUTH_SECRET');
  });
  it('bounds nested mutation data without transforming decimals, nulls or UTF-8 text', () => {
    expect(() => assertInputBounds({ name: 'نعناع', notes: 'é'.repeat(10000), price: '12.500', optional: null })).not.toThrow();
    for (const body of [{ name: 'x'.repeat(501) }, { notes: 'x'.repeat(10001) }, { lines: Array(1001).fill({}) }]) expect(() => assertInputBounds(body)).toThrow(BadRequestException);
    const nested: Record<string, unknown> = {}; nested.child = nested; expect(() => assertInputBounds(nested)).toThrow('imbriqué');
  });
  it('sets security headers, rejects foreign CORS, accepts exact preflight, hides internal production errors and preserves 400', async () => {
    for (const [key, value] of Object.entries(production())) vi.stubEnv(key, value);
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    app = (await Test.createTestingModule({ controllers: [ProbeController] }).compile()).createNestApplication();
    configureHttpSecurity(app); await app.init();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const good = await request(server).options('/probe').set('Origin', production().FRONTEND_ORIGIN).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'Content-Type').expect(204);
    expect(good.headers['access-control-allow-origin']).toBe(production().FRONTEND_ORIGIN);
    expect(good.headers['access-control-allow-credentials']).toBe('true');
    expect(good.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE,OPTIONS');
    expect(good.headers['access-control-allow-headers']).toBe('Content-Type,Authorization');
    expect(good.headers['x-content-type-options']).toBe('nosniff'); expect(good.headers['x-frame-options']).toBe('DENY'); expect(good.headers['referrer-policy']).toBe('no-referrer');
    expect(good.headers['strict-transport-security']).toContain('max-age=31536000'); expect(good.headers['x-powered-by']).toBeUndefined();
    for (const method of ['get', 'options'] as const) { const bad = await request(server)[method]('/probe').set('Origin', 'https://evil.example').expect(403); expect(bad.headers['access-control-allow-origin']).toBeUndefined(); }
    await request(server).get('/probe').expect(200);
    for (const path of ['/failure', '/http-failure']) expect((await request(server).get(path).expect(500)).body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/SQL|Prisma|passwordHash|private|secret-value/);
    expect((await request(server).post('/probe').send({}).expect(400)).body.message).toBe('Quantité invalide.');
    const malformed = await request(server).post('/probe').set('Content-Type', 'application/json').send('{"secret":').expect(400);
    expect(malformed.body).not.toHaveProperty('stack');
    await request(server).post('/probe').send({ text: 'x'.repeat(110000) }).expect(413);
    await request(server).post('/bounded').send({ name: 'x'.repeat(501) }).expect(400);
    const body = { name: 'نعناع', quantity: '12.500', notes: null };
    expect((await request(server).post('/bounded').send(body).expect(201)).body).toEqual(body);
  });
});
