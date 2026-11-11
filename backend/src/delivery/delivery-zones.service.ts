import { Injectable } from '@nestjs/common';
import type { Client } from 'pg';
import { withPurchaseTransaction as transaction } from '../purchases/purchase-transaction.js';
import { audited } from '../audit/audit.service.js';
import { deliveryZoneInput, governorates } from './delivery-values.js';

export type DeliveryZoneRow = { id: number; governorate: string; fee: string; freeAbove: string | null; delay: string | null; isActive: boolean };
const columns = 'id, governorate, fee::text AS fee, "freeAbove"::text AS "freeAbove", delay, "isActive"';
const order = (rows: DeliveryZoneRow[]) => rows.sort((a, b) => (governorates as readonly string[]).indexOf(a.governorate) - (governorates as readonly string[]).indexOf(b.governorate));

export async function activeDeliveryZones(client: Client): Promise<DeliveryZoneRow[]> {
  return order((await client.query<DeliveryZoneRow>(`SELECT ${columns} FROM public."deliveryZone" WHERE "isActive"`)).rows);
}

@Injectable()
export class DeliveryZonesService {
  /** Back office: every governorate, configured or not. */
  list() {
    return transaction(async (tx) => {
      const rows = (await tx.client.query<DeliveryZoneRow>(`SELECT ${columns} FROM public."deliveryZone"`)).rows;
      const found = new Map(rows.map((row) => [row.governorate, row]));
      return governorates.map((governorate) => found.get(governorate) ?? { id: null, governorate, fee: null, freeAbove: null, delay: null, isActive: false });
    }, true);
  }
  update(raw: unknown) {
    const input = deliveryZoneInput(raw);
    return transaction(async (tx) => {
      const row = (await tx.client.query<DeliveryZoneRow>(
        `INSERT INTO public."deliveryZone" (governorate, fee, "freeAbove", delay, "isActive", "sortOrder", "updatedAt")
         VALUES ($1, $2::numeric, $3::numeric, $4, $5, $6, now())
         ON CONFLICT (governorate) DO UPDATE SET fee = EXCLUDED.fee, "freeAbove" = EXCLUDED."freeAbove", delay = EXCLUDED.delay, "isActive" = EXCLUDED."isActive", "updatedAt" = now()
         RETURNING ${columns}`,
        [input.governorate, input.fee, input.freeAbove, input.delay, input.isActive, governorates.indexOf(input.governorate)],
      )).rows[0];
      return audited(tx, 'DELIVERY_ZONE_UPDATE', 'DELIVERY_ZONE', row, { fee: row.fee, freeAbove: row.freeAbove, isActive: row.isActive }, row.id, row.governorate);
    });
  }
  /** Storefront: active zones only, without internal ids. */
  publicList() {
    return transaction(async (tx) => (await activeDeliveryZones(tx.client)).map(({ governorate, fee, freeAbove, delay }) => ({ governorate, fee, freeAbove, delay })), true);
  }
}
