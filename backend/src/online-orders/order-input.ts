import { BadRequestException } from '@nestjs/common';
import { cartInput } from '../public-catalogue/cart-validation.js';

export function orderObject(body: unknown, keys: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !keys.includes(key))) throw new BadRequestException('Données de commande invalides.');
  return body as Record<string, unknown>;
}
export function orderInput(body: unknown) {
  const value = orderObject(body, ['customerName', 'customerPhone', 'customerEmail', 'deliveryAddress', 'notes', 'items']);
  const text = (key: string, max: number, required = false) => {
    const raw = value[key];
    if ((raw === undefined || raw === null) && !required) return null;
    if (typeof raw !== 'string' || raw.length > max || (required && !raw.trim())) throw new BadRequestException(`Champ ${key} invalide.`);
    return raw.trim() || null;
  };
  const customerName = text('customerName', 150, true)!, customerPhone = text('customerPhone', 40, true)!;
  if (!/^\+?[\d ().-]{6,40}$/.test(customerPhone) || customerPhone.replace(/\D/g, '').length < 6) throw new BadRequestException('Téléphone invalide.');
  const deliveryAddress = text('deliveryAddress', 500, true)!;
  const customerEmail = text('customerEmail', 254), notes = text('notes', 2000);
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new BadRequestException('Email invalide.');
  const items = cartInput({ items: value.items });
  if (!items.length) throw new BadRequestException('Le panier est vide.');
  return { customerName, customerPhone, customerEmail, deliveryAddress, notes, items };
}
// Dynamic decimal scales preserve even prices with more than 18 fractional digits.
function parts(value: string) { const [whole, fraction = ''] = value.split('.'); return { value: BigInt(whole + fraction), scale: fraction.length }; }
function format(value: bigint, scale: number) { const text = value.toString().padStart(scale + 1, '0'); return scale ? `${text.slice(0, -scale)}.${text.slice(-scale).replace(/0+$/, '').padEnd(3, '0')}` : `${text}.000`; }
export function orderLineTotal(quantity: string, price: string) { const a = parts(quantity), b = parts(price); return format(a.value * b.value, a.scale + b.scale); }
export function orderTotal(values: string[]) { return values.reduce((sum, value) => { const a = parts(sum), b = parts(value), scale = Math.max(a.scale, b.scale); return format(a.value * 10n ** BigInt(scale - a.scale) + b.value * 10n ** BigInt(scale - b.scale), scale); }, '0.000'); }
