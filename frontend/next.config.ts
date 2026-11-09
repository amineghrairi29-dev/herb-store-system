import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(process.env.NODE_ENV === 'production' && (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL)?.startsWith('https://')
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
    ] }];
  },
};

if (process.env.NODE_ENV === 'production') {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!origin) throw new Error('NEXT_PUBLIC_API_BASE_URL is required for a production build/start (legacy NEXT_PUBLIC_API_URL is also accepted).');
  let url: URL;
  try { url = new URL(origin); } catch { throw new Error('NEXT_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL.'); }
  if (url.username || url.password || url.search || url.hash || !['', '/', '/api', '/api/'].includes(url.pathname) || !['http:', 'https:'].includes(url.protocol) ||
      (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL must be an HTTPS origin, optionally ending in /api (HTTP allowed only on local loopback).');
  }
}

export default nextConfig;
