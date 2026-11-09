import type { CookieOptions, Request } from 'express';
export function frontendOrigin() {
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  if (!/^https?:\/\//.test(origin) || new URL(origin).origin !== origin || (process.env.NODE_ENV === 'production' && !origin.startsWith('https://'))) throw new Error('FRONTEND_ORIGIN must be an exact origin (HTTPS in production).');
  return origin;
}
export const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-herb_session' : 'herb_session';
export function sessionMilliseconds() {
  const hours = Number(process.env.AUTH_SESSION_HOURS || '8');
  if (!Number.isFinite(hours) || hours < 0.05 || hours > 168) throw new Error('AUTH_SESSION_HOURS must be between 0.05 and 168.');
  return hours * 3600000;
}
export const cookieOptions = (): CookieOptions => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
export function sessionToken(request: Request): string | undefined {
  const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName()}=`))?.slice(cookieName().length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
