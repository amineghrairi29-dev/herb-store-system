import type { Request } from 'express';

// Never trust forwarded headers for this local-only escape hatch.
export function devAdminBypass(request: Request): boolean {
  if (process.env.NODE_ENV !== 'development' || process.env.DEV_ADMIN_BYPASS !== 'true') return false;
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (!local.includes(request.socket.remoteAddress ?? '')) return false;
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(request.hostname)) return false;
  const origin = request.headers.origin;
  if (origin) {
    try { if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) return false; }
    catch { return false; }
  }
  return true;
}
