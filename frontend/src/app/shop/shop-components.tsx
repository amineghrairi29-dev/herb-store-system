import type { Availability } from "@/types/public-product";
import { displayAmount } from "@/lib/purchase-decimal";
import ProductImage from '@/components/product-image';

export const availabilityLabels: Record<Availability, string> = { IN_STOCK: "Disponible", LOW_STOCK: "Stock limité", OUT_OF_STOCK: "Rupture de stock" };
export function AvailabilityBadge({ status }: { status: Availability }) {
  const colors = { IN_STOCK: "bg-emerald-50 text-emerald-800", LOW_STOCK: "bg-amber-50 text-amber-900", OUT_OF_STOCK: "bg-stone-100 text-stone-600" };
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${colors[status]}`}>{availabilityLabels[status]}</span>;
}
export function ProductPrice({ price, unit }: { price: string; unit: string }) {
  const units: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PIECE: "pièce" };
  return <p className="break-words text-lg font-semibold text-emerald-950">{displayAmount(price)} DT <span className="text-sm font-normal text-stone-600">/ {units[unit] ?? unit}</span></p>;
}
export function ProductVisual({ imagePath, name = '' }: { imagePath?: string | null; name?: string }) {
  const style = 'flex aspect-[4/3] items-center justify-center rounded-xl bg-stone-100 text-emerald-800/40';
  return <ProductImage imagePath={imagePath} name={name} className={style} fallback={<div aria-hidden="true" className={style}><svg width="80" height="80" viewBox="0 0 80 80" fill="none"><path d="M22 60C8 24 48 12 64 14C66 44 52 66 22 60Z" stroke="currentColor" strokeWidth="2"/><path d="M16 70L53 28M30 52L29 35M37 44L52 44" stroke="currentColor" strokeWidth="2"/></svg></div>} />;
}
