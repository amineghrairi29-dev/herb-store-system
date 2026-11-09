import { allowed, type Permission } from './auth-policy.js';
import { cookieName, cookieOptions, sessionMilliseconds } from './auth-config.js';
import { passwordValue, emailValue, roleValue } from './user-validation.js';
describe('Auth security policy', () => {
  const modules: Permission[] = ['AUTH', 'CATEGORIES', 'PRODUCTS', 'STOCK', 'SUPPLIERS', 'PURCHASES', 'SALES', 'CASH', 'EXPENSES', 'FINANCE', 'REPORTS', 'ONLINE_ORDERS', 'USERS', 'SYSTEM'];
  it.each(['ADMIN', 'CUSTOMER', 'MANAGER', 'SELLER', 'AGENT', 'UNKNOWN'])('covers every module and HTTP method for %s', role => {
    for (const module of modules) for (const method of ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE']) {
      const expected = role === 'ADMIN';
      expect(allowed(role, module, method)).toBe(expected);
    }
  });
  it('uses secure host-only production cookies and configurable bounded expiration', () => {
    vi.stubEnv('NODE_ENV', 'production'); expect(cookieName()).toBe('__Host-herb_session'); expect(cookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    vi.stubEnv('AUTH_SESSION_HOURS', '4'); expect(sessionMilliseconds()).toBe(14400000); vi.stubEnv('AUTH_SESSION_HOURS', '0'); expect(() => sessionMilliseconds()).toThrow(); vi.unstubAllEnvs();
  });
  it('validates normalized email, UTF-8 passwords without bcrypt truncation and roles', () => {
    expect(emailValue(' Person@Example.com ')).toBe('person@example.com'); expect(passwordValue('مرحبا12345')).toBe('مرحبا12345');
    for (const password of ['short1', 'abcdefgh', '12345678', 'ا'.repeat(36) + '1']) expect(() => passwordValue(password)).toThrow();
    expect(roleValue('ADMIN')).toBe('ADMIN');
    for (const role of ['OWNER', 'MANAGER', 'SELLER', 'AGENT', 'CUSTOMER']) expect(() => roleValue(role)).toThrow();
  });
});
