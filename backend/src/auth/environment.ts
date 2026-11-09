/** Validated before the application (and its database providers) are imported. */
export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const production = env.NODE_ENV === 'production';
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI) {
    let callback: URL;
    try { callback = new URL(env.GOOGLE_REDIRECT_URI); } catch { throw new Error('GOOGLE_REDIRECT_URI must be an absolute URL.'); }
    if (callback.username || callback.password || callback.hash || callback.search || !callback.pathname.endsWith('/public/auth/google/callback') || (callback.protocol !== 'https:' && !(callback.protocol === 'http:' && !production && ['localhost', '127.0.0.1'].includes(callback.hostname)))) throw new Error('GOOGLE_REDIRECT_URI must use HTTPS (local HTTP allowed only in development) and the customer callback path.');
  }
  proxyTrust(env);
  if (env.COOKIE_SECURE !== undefined && env.COOKIE_SECURE !== '' && env.COOKIE_SECURE !== String(production)) throw new Error('COOKIE_SECURE must match NODE_ENV; production cookies cannot be insecure.');
  if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) throw new Error('PORT must be between 1 and 65535.');
  if (production && !env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required in production.');
  if (env.DATABASE_URL) {
    let url: URL;
    try { url = new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL must be a PostgreSQL connection URL.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error('DATABASE_URL must include a PostgreSQL host and database.');
  }
  const secret = env.AUTH_SECRET;
  if (production && !secret) throw new Error('AUTH_SECRET is required in production.');
  if (secret && (Buffer.byteLength(secret) < 32 || new Set(secret).size < 12 || /^(change.?me|example|placeholder|your.?secret)/i.test(secret))) throw new Error('AUTH_SECRET must be a securely generated secret of at least 32 bytes (use 32 random bytes encoded as hex).');
  if (production && !env.FRONTEND_ORIGIN) throw new Error('FRONTEND_ORIGIN is required in production.');
  const origin = env.FRONTEND_ORIGIN || (production ? '' : 'http://localhost:3000');
  let url: URL;
  try { url = new URL(origin); } catch { throw new Error('FRONTEND_ORIGIN must be an exact HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || (production && url.protocol !== 'https:')) throw new Error('FRONTEND_ORIGIN must be an exact origin (HTTPS in production).');
  const hours = Number(env.AUTH_SESSION_HOURS || '8');
  if (!Number.isFinite(hours) || hours < 0.05 || hours > 168) throw new Error('AUTH_SESSION_HOURS must be between 0.05 and 168.');
}

/** Only an explicitly local reverse proxy is supported by this V1 topology. */
export function proxyTrust(env: NodeJS.ProcessEnv = process.env): false | 'loopback' {
  if (!env.TRUST_PROXY || env.TRUST_PROXY === 'false') return false;
  if (env.TRUST_PROXY === 'loopback') return 'loopback';
  throw new Error('TRUST_PROXY must be false or loopback; unrestricted forwarded headers are not supported.');
}
