import { generateKeyPairSync, sign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { CertificateFormat } from 'google-auth-library/build/src/auth/oauth2client.js';
import { GoogleAuthService } from './google-auth.service.js';
import { safeReturn } from './customer-config.js';
describe('Google OIDC verification and redirect boundaries', () => {
  const service = new GoogleAuthService();
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwt = (overrides: Record<string, unknown> = {}) => {
    const encode = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString('base64url');
    const data =
      encode({ alg: 'RS256', kid: 'test' }) +
      '.' +
      encode({
        iss: 'https://accounts.google.com',
        aud: 'test-client',
        sub: 'google-sub',
        email: 'test@gmail.com',
        email_verified: true,
        nonce: 'nonce',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...overrides,
      });
    return (
      data +
      '.' +
      sign('RSA-SHA256', Buffer.from(data), keys.privateKey).toString(
        'base64url',
      )
    );
  };
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-secret');
    vi.stubEnv(
      'GOOGLE_REDIRECT_URI',
      'http://localhost:3001/public/auth/google/callback',
    );
    vi.spyOn(
      OAuth2Client.prototype,
      'getFederatedSignonCertsAsync',
    ).mockResolvedValue({
      certs: {
        test: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      },
      format: CertificateFormat.PEM,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it('verifies a signed token with issuer, audience, verified email and nonce', async () => {
    expect(await service.verify(jwt(), 'nonce')).toMatchObject({
      sub: 'google-sub',
      authoritative: true,
    });
  });
  it.each([
    { aud: 'other' },
    { iss: 'https://evil.example' },
    { exp: 1 },
    { email_verified: false },
    { email_verified: 'true' },
    { nonce: 'wrong' },
    { sub: '' },
  ])('rejects invalid claims %j', async (claims) => {
    await expect(service.verify(jwt(claims), 'nonce')).rejects.toThrow();
  });
  it('rejects bad signatures and malformed tokens', async () => {
    await expect(
      service.verify(jwt().slice(0, -20) + 'forged', 'nonce'),
    ).rejects.toThrow();
    await expect(service.verify('not-a-token', 'nonce')).rejects.toThrow();
  });
  it('does not treat third-party email as authoritative', async () => {
    expect(
      (await service.verify(jwt({ email: 'test@example.org' }), 'nonce'))
        .authoritative,
    ).toBe(false);
  });
  it('binds OAuth state, PKCE and return URL to an expiring signed browser cookie', async () => {
    const start = await service.start('/shop/checkout'),
      url = new URL(start.url);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(
      service.readFlow(start.cookie, url.searchParams.get('state')).returnTo,
    ).toBe('/shop/checkout');
    expect(() => service.readFlow(start.cookie, 'wrong')).toThrow();
    expect(() =>
      service.readFlow(start.cookie + 'x', url.searchParams.get('state')),
    ).toThrow();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 700000);
    expect(() =>
      service.readFlow(start.cookie, url.searchParams.get('state')),
    ).toThrow();
  });
  it.each([
    'https://evil.test',
    '//evil.test',
    '/shop/../users',
    '/shop/auth',
    '/users',
    '/shop/checkout?returnTo=//evil',
    '/shop%2fcheckout',
  ])('rejects redirect %s', (value) => expect(safeReturn(value)).toBe('/shop'));
  it('Google is disabled without credentials', () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(service.enabled()).toBe(false);
  });
  it('preserves the profile return target', async () => {
    const start = await service.start('/shop/profile');
    expect(service.readFlow(start.cookie, new URL(start.url).searchParams.get('state')).returnTo).toBe('/shop/profile');
  });
  it('signs the initial-entry context separately from action-gated auth', async () => {
    const start = await service.start('/shop', true);
    const flow = service.readFlow(start.cookie, new URL(start.url).searchParams.get('state'));
    expect(flow.entry).toBe(true);
    expect(flow.returnTo).toBe('/shop');
    const gated = await service.start('/shop/checkout');
    expect(service.readFlow(gated.cookie, new URL(gated.url).searchParams.get('state')).entry).toBe(false);
  });
});
