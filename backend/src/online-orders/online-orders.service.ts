import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { withPurchaseTransaction as transaction } from '../purchases/purchase-transaction.js';
import { audited } from '../audit/audit.service.js';
import { purchaseId } from '../purchases/purchase-validation.js';
import { validateCartInTransaction } from '../public-catalogue/public-cart.service.js';
import { orderInput, orderLineTotal, orderObject, orderTotal, tunisianPhone } from './order-input.js';
import { cartInput, type CartInput } from '../public-catalogue/cart-validation.js';
import type { Client } from 'pg';
import { notifyNewOrder } from './order-notifier.js';
import { activeDeliveryZones } from '../delivery/delivery-zones.service.js';
import { deliveryFee, isGovernorate } from '../delivery/delivery-values.js';

/**
 * Delivery for an order. With no active zone (delivery prices not set up yet), orders keep working without a fee.
 * Once zones exist, the governorate is required and must be one of them.
 */
async function deliveryQuote(client: Client, governorate: string | null, itemsTotal: string, required: boolean) {
  const zones = await activeDeliveryZones(client);
  if (!zones.length) return { governorate, fee: null as string | null, delay: null as string | null };
  if (!governorate) { if (required) throw new BadRequestException('Choisissez votre gouvernorat de livraison.'); return { governorate: null, fee: null, delay: null }; }
  const zone = zones.find((row) => row.governorate === governorate);
  if (!zone) throw new BadRequestException('La livraison n’est pas disponible pour ce gouvernorat.');
  return { governorate, fee: deliveryFee(zone, itemsTotal), delay: zone.delay };
}

async function orderQuote(client: Client, items: CartInput[]) {
  const checked = await validateCartInTransaction(client, items);
  if (checked.items.some((item) => !item.valid || !item.product)) throw new ConflictException('Un produit ou une quantité est indisponible. Actualisez le panier.');
  const lines = checked.items.map((item, index) => ({ productId: item.productId, productNameSnapshot: item.product!.name, unitSnapshot: item.product!.saleUnit, quantity: items[index].quantity, unitPrice: item.currentPrice!, lineTotal: orderLineTotal(items[index].quantity, item.currentPrice!) }));
  return { items: lines, totalAmount: orderTotal(lines.map((line) => line.lineTotal)) };
}

@Injectable()
export class OnlineOrdersService {
  preview(body: unknown) {
    const value = orderObject(body, ['items', 'deliveryGovernorate']);
    const items = cartInput({ items: value.items });
    if (!items.length) throw new BadRequestException('Le panier est vide.');
    const governorate = value.deliveryGovernorate === undefined || value.deliveryGovernorate === null || value.deliveryGovernorate === '' ? null : value.deliveryGovernorate;
    if (governorate !== null && !isGovernorate(governorate)) throw new BadRequestException('Gouvernorat inconnu.');
    return transaction(async (tx) => {
      const quote = await orderQuote(tx.client, items);
      const delivery = await deliveryQuote(tx.client, governorate as string | null, quote.totalAmount, false);
      return { ...quote, deliveryFee: delivery.fee, deliveryDelay: delivery.delay, grandTotal: orderTotal([quote.totalAmount, delivery.fee ?? '0.000']) };
    }, true);
  }
  async create(body: unknown, customerId: number | null = null) {
    const input = orderInput(body);
    const created = await transaction(async (tx) => {
      await tx.client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const account = customerId === null ? null : (await tx.client.query<{ email: string }>('SELECT email FROM public.customer WHERE id = $1', [customerId])).rows[0];
      const { items: lines, totalAmount: total } = await orderQuote(tx.client, input.items);
      const delivery = await deliveryQuote(tx.client, input.deliveryGovernorate, total, true);
      // The table's database sequence allocates IDs atomically; rollback may leave gaps.
      const inserted = await tx.client.query<{ id: number }>(`WITH next AS (SELECT nextval(pg_get_serial_sequence('public."onlineOrder"', 'id')) AS id)
        INSERT INTO public."onlineOrder" (id, reference, status, "customerName", "customerPhone", "customerEmail", notes, "totalAmount", "updatedAt", "customerId", "deliveryAddress", "deliveryGovernorate", "deliveryCity", "deliveryFee")
        SELECT id, 'ORD-' || lpad(id::text, GREATEST(6, length(id::text)), '0'), 'PENDING', $1, $2, $3, $4, $5::numeric, now(), $6, $7, $8, $9, $10::numeric FROM next RETURNING id`, [input.customerName, input.customerPhone, account?.email ?? input.customerEmail, input.notes, total, customerId, input.deliveryAddress, delivery.governorate, input.deliveryCity, delivery.fee]);
      const id = inserted.rows[0].id;
      for (const line of lines) await tx.orm.public.OnlineOrderLine.create({ orderId: id, ...line });
      const order = (await tx.orm.public.OnlineOrder.first({ id }))!;
      return { reference: order.reference, status: order.status, customerName: order.customerName, totalAmount: order.totalAmount, deliveryFee: delivery.fee, deliveryDelay: delivery.delay, grandTotal: orderTotal([total, delivery.fee ?? '0.000']), createdAt: order.createdAt, items: lines.map(({ productId, ...line }) => ({ productId, ...line })) };
    });
    // After commit, outside the transaction; never awaited so the customer is not kept waiting.
    void notifyNewOrder({ ...created, totalAmount: String(created.totalAmount), customerPhone: input.customerPhone, deliveryAddress: [input.deliveryAddress, input.deliveryCity, input.deliveryGovernorate].filter(Boolean).join(', '), notes: input.notes });
    return created;
  }

  async lookup(reference: string, phone: unknown) {
    const missing = () => new NotFoundException('Commande introuvable.');
    if (!/^ORD-\d{6,10}$/.test(reference) || typeof phone !== 'string' || !phone.trim() || phone.length > 40) throw missing();
    return transaction(async (tx) => {
      const order = await tx.orm.public.OnlineOrder.first({ reference });
      // Accepts "98 123 456", "+216 98123456"... and still matches orders stored before normalization.
      const given = tunisianPhone(phone) ?? phone.trim();
      if (!order || (tunisianPhone(order.customerPhone) ?? order.customerPhone.trim()) !== given) throw missing();
      const lines = await tx.orm.public.OnlineOrderLine.where({ orderId: order.id }).orderBy((row) => row.id.asc()).all();
      const fee = order.deliveryFee === null ? null : String(order.deliveryFee);
      return { reference: order.reference, status: order.status, totalAmount: order.totalAmount, deliveryFee: fee, grandTotal: orderTotal([String(order.totalAmount), fee ?? '0.000']), deliveryGovernorate: order.deliveryGovernorate, createdAt: order.createdAt,
        items: lines.map(({ productNameSnapshot, unitSnapshot, quantity, unitPrice, lineTotal }) => ({ productNameSnapshot, unitSnapshot, quantity, unitPrice, lineTotal })) };
    }, true);
  }

  async list(query: Record<string, unknown>) {
    const allowed = ['q', 'status', 'dateFrom', 'dateTo', 'page'];
    if (Object.keys(query).some((key) => !allowed.includes(key)) || Object.values(query).some((value) => typeof value !== 'string' || value.length > 200)) throw new BadRequestException('Filtres invalides.');
    const q = String(query.q ?? '').trim(), status = String(query.status ?? ''), from = String(query.dateFrom ?? ''), to = String(query.dateTo ?? ''), page = String(query.page ?? '1');
    const date = (value: string) => !value || (value >= '0001-01-01' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
    if ((status && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) || !date(from) || !date(to) || (from && to && from > to) || !/^[1-9]\d{0,6}$/.test(page)) throw new BadRequestException('Filtres invalides.');
    return transaction(async (tx) => {
      const values = [q, status, from || null, to || null];
      const where = `WHERE ($1 = '' OR strpos(lower(concat_ws(' ', reference, "customerName", "customerPhone")), lower($1)) > 0) AND ($2 = '' OR status = $2)
        AND ($3::date IS NULL OR "createdAt" >= ($3::date::timestamp AT TIME ZONE 'Africa/Tunis')) AND ($4::date IS NULL OR "createdAt" < (($4::date + 1)::timestamp AT TIME ZONE 'Africa/Tunis'))`;
      const count = await tx.client.query<{ count: string }>(`SELECT count(*)::text FROM public."onlineOrder" ${where}`, values);
      const rows = await tx.client.query<{ id: number; reference: string; status: string; customerName: string; customerPhone: string; totalAmount: string; deliveryFee: string | null; deliveryGovernorate: string | null; createdAt: string; saleId: number | null; fulfillmentStatus: 'NOT_CONVERTED' | 'CONVERTED'; sale: { id: number; reference: string; status: string } | null }>(`SELECT id, reference, status, "customerName", "customerPhone", "totalAmount"::text, "deliveryFee"::text, "deliveryGovernorate", "createdAt"::text, "saleId", CASE WHEN "saleId" IS NULL THEN 'NOT_CONVERTED' ELSE 'CONVERTED' END AS "fulfillmentStatus", (SELECT json_build_object('id', s.id, 'reference', s.reference, 'status', s.status) FROM public.sale s WHERE s.id = "onlineOrder"."saleId") AS sale FROM public."onlineOrder" ${where} ORDER BY "createdAt" DESC, id DESC LIMIT 25 OFFSET $5`, [...values, (Number(page) - 1) * 25]);
      return { data: rows.rows, pagination: { page: Number(page), totalPages: Math.ceil(Number(count.rows[0].count) / 25), totalItems: Number(count.rows[0].count) } };
    }, true);
  }
  detail(id: number) {
    purchaseId(id);
    return transaction(async (tx) => {
      const order = await tx.orm.public.OnlineOrder.first({ id }); if (!order) throw new NotFoundException('Commande introuvable.');
      const sale = order.saleId === null ? null : await tx.orm.public.Sale.select('id', 'reference', 'status').first({ id: order.saleId });
      return { ...order, fulfillmentStatus: order.saleId === null ? 'NOT_CONVERTED' : 'CONVERTED', sale: sale ?? null, items: await tx.orm.public.OnlineOrderLine.where({ orderId: id }).orderBy((row) => row.id.asc()).all() };
    }, true);
  }
  status(id: number, body: unknown) {
    purchaseId(id); const { status } = orderObject(body, ['status']);
    if (status !== 'CONFIRMED' && status !== 'CANCELLED') throw new BadRequestException('Statut invalide.');
    return transaction(async (tx) => {
      await tx.client.query('SELECT id FROM public."onlineOrder" WHERE id = $1 FOR UPDATE', [id]);
      const order = await tx.orm.public.OnlineOrder.first({ id });
      if (!order) throw new NotFoundException('Commande introuvable.');
      if (order.saleId !== null) throw new ConflictException('Cette commande possède une vente et ne peut plus être annulée ou changer de statut.');
      if (order.status !== 'PENDING') throw new ConflictException('Seule une commande en attente peut être confirmée ou annulée.');
      return audited(tx, status === 'CONFIRMED' ? 'ONLINE_ORDER_CONFIRM' : 'ONLINE_ORDER_CANCEL', 'ONLINE_ORDER', await tx.orm.public.OnlineOrder.where({ id }).update({ status, ...(status === 'CONFIRMED' ? { confirmedAt: new Date().toISOString() } : { cancelledAt: new Date().toISOString() }) }));
    });
  }
}
