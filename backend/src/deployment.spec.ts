import { Controller, Get, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { configureHttpSecurity } from './auth/http-security.js';
import { validateEnvironment } from './auth/environment.js';
import { HealthController } from './health.controller.js';
import { DatabaseLifecycle } from './prisma/database-lifecycle.js';
import { db } from './prisma/db.js';

vi.mock('./prisma/db.js', () => ({ db: { close: vi.fn().mockResolvedValue(undefined) } }));
@Controller('proxy-probe')
class ProxyProbe {
  @Get() read(@Req() req: Request) { return { ip: req.ip, secure: req.secure }; }
}
describe('Deployment boundary', () => {
  let app: INestApplication;
  afterEach(async () => { await app?.close(); vi.unstubAllEnvs(); });
  it.each(['true', '1', '0.0.0.0/0'])('rejects unrestricted/ambiguous proxy setting %s', TRUST_PROXY => {
    expect(() => validateEnvironment({ TRUST_PROXY })).toThrow('TRUST_PROXY');
  });
  it('does not permit an insecure production cookie override', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow('COOKIE_SECURE');
  });
  it.each(['false', 'loopback'])('health is minimal and proxy trust is explicit (%s)', async trust => {
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('FRONTEND_ORIGIN', 'http://localhost:3000'); vi.stubEnv('TRUST_PROXY', trust);
    app = (await Test.createTestingModule({ controllers: [HealthController, ProxyProbe] }).compile()).createNestApplication();
    configureHttpSecurity(app); await app.init();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const health = await request(server).get('/health').expect(200);
    expect(health.body).toEqual({ status: 'ok' }); expect(health.headers['cache-control']).toBe('no-store');
    const probe = await request(server).get('/proxy-probe').set('X-Forwarded-For', '203.0.113.10').set('X-Forwarded-Proto', 'https').expect(200);
    expect(probe.body.secure).toBe(trust === 'loopback');
    if (trust === 'loopback') expect(probe.body.ip).toBe('203.0.113.10');
    else expect(probe.body.ip).not.toBe('203.0.113.10');
  });
  it('closes the shared Prisma runtime on application shutdown', async () => {
    await new DatabaseLifecycle().onApplicationShutdown();
    expect(db.close).toHaveBeenCalledOnce();
  });
});
