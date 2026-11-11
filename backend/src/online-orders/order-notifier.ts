import { Logger } from '@nestjs/common';

export type OrderNotice = {
  reference: string;
  totalAmount: string;
  deliveryFee?: string | null;
  grandTotal?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  notes: string | null;
  items: { productNameSnapshot: string; quantity: string; unitSnapshot: string }[];
};

const logger = new Logger('OrderNotifier');

export function orderNoticeText(order: OrderNotice): string {
  const lines = order.items.map((item) => `• ${item.productNameSnapshot} — ${item.quantity} ${item.unitSnapshot}`);
  return [
    `🛒 Nouvelle commande ${order.reference}`,
    ...(order.deliveryFee != null ? [`Articles : ${order.totalAmount} TND · Livraison : ${order.deliveryFee} TND`, `Total à encaisser : ${order.grandTotal ?? order.totalAmount} TND`] : [`Total : ${order.totalAmount} TND`]),
    '',
    `Client : ${order.customerName}`,
    `Téléphone : ${order.customerPhone}`,
    `Adresse : ${order.deliveryAddress}`,
    ...(order.notes ? [`Note : ${order.notes}`] : []),
    '',
    ...lines,
  ].join('\n');
}

/**
 * Sends a Telegram message to the shop for each new order.
 * Optional: does nothing unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.
 * Never throws: a notification failure must not fail an order that is already saved.
 */
export async function notifyNewOrder(order: OrderNotice): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: orderNoticeText(order).slice(0, 4000) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) logger.warn(`Telegram notification failed for ${order.reference}: HTTP ${response.status}`);
  } catch (error) {
    logger.warn(`Telegram notification failed for ${order.reference}: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
