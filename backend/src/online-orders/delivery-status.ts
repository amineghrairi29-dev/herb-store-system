/** Delivery tracking after the shop confirms an order. Independent of the sale conversion. */
export const deliveryStatuses = ['PREPARING', 'SHIPPED', 'DELIVERED', 'RETURNED'] as const;
export type DeliveryStatus = typeof deliveryStatuses[number];

const allowed: Record<string, readonly DeliveryStatus[]> = {
  '': ['PREPARING', 'SHIPPED', 'DELIVERED'],
  PREPARING: ['SHIPPED', 'DELIVERED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
};

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === 'string' && (deliveryStatuses as readonly string[]).includes(value);
}

/** Forward-only moves; a delivered or shipped order can still come back as returned. */
export function canMoveDelivery(from: string | null, to: DeliveryStatus): boolean {
  return (allowed[from ?? ''] ?? []).includes(to);
}
