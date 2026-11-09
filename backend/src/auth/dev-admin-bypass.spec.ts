import type { Request } from 'express';
import { devAdminBypass } from './dev-admin-bypass.js';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import type { AuthService } from './auth.service.js';

const request = (remoteAddress = '127.0.0.1', hostname = 'localhost', origin = 'http://localhost:3000') =>
  ({ socket: { remoteAddress }, hostname, headers: { origin } }) as Request;

describe('local ADMIN bypass boundary', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('DEV_ADMIN_BYPASS', 'true'); });
  it('allows an explicitly enabled local development request', () => expect(devAdminBypass(request())).toBe(true));
  it.each(['production', 'test', ''])('never bypasses in %s', mode => {
    vi.stubEnv('NODE_ENV', mode);
    expect(devAdminBypass(request())).toBe(false);
  });
  it.each(['false', '', 'TRUE'])('requires the exact opt-in flag (%s)', flag => {
    vi.stubEnv('DEV_ADMIN_BYPASS', flag);
    expect(devAdminBypass(request())).toBe(false);
  });
  it('rejects remote connections, hosts and origins', () => {
    expect(devAdminBypass(request('192.168.1.2'))).toBe(false);
    expect(devAdminBypass(request('127.0.0.1', 'example.com'))).toBe(false);
    expect(devAdminBypass(request('127.0.0.1', 'localhost', 'https://example.com'))).toBe(false);
  });
  it.each([['production', 'true'], ['development', 'false']])('guard requires a real session in %s with flag %s', async (mode, flag) => {
    vi.stubEnv('NODE_ENV', mode); vi.stubEnv('DEV_ADMIN_BYPASS', flag);
    const current = vi.fn().mockRejectedValue(new UnauthorizedException());
    const localAdmin = vi.fn();
    const guard = new AuthGuard({ getAllAndOverride: () => 'AUTH' } as unknown as Reflector, { current, localAdmin } as unknown as AuthService);
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => request(), getResponse: () => ({ setHeader: vi.fn() }) }) } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(current).toHaveBeenCalledWith(undefined);
    expect(localAdmin).not.toHaveBeenCalled();
  });
});
