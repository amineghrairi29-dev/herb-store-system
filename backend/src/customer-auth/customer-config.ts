import type { Request } from 'express';
export const customerCookie = () =>
  process.env.NODE_ENV === 'production'
    ? '__Host-herb_customer'
    : 'herb_customer';
export const googleCookie = () =>
  process.env.NODE_ENV === 'production' ? '__Host-herb_google' : 'herb_google';
export function readCookie(request: Request, name = customerCookie()) {
  return request.headers.cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))
    ?.slice(name.length + 1);
}
export function customerToken(request: Request) {
  const token = readCookie(request);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
export function safeReturn(value: unknown): string {
  // Deliberately small storefront allowlist; no arbitrary URLs or redirect chains.
  return typeof value === 'string' &&
    ['/shop', '/shop/checkout', '/shop/cart', '/shop/catalogue', '/shop/profile'].includes(value)
    ? value
    : '/shop';
}
export interface CustomerInfo {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  deliveryAddress: string | null;
}
