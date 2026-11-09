import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SalesService } from '../sales/sales.service.js';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { moneyUnits, purchaseId } from '../purchases/purchase-validation.js';
import { businessDate } from '../cash/cash-values.js';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';
import { audited } from '../audit/audit.service.js';

@Injectable()
export class OrderFulfillmentService {
  constructor(private readonly sales: SalesService) {}
  async convert(id: number) {
    purchaseId(id);
    try {
      return await withPurchaseTransaction(async (tx) => {
        // Every converter locks the same order before checking or creating its sale.
        await tx.client.query('SELECT id FROM public."onlineOrder" WHERE id = $1 FOR UPDATE', [id]);
        const order = await tx.orm.public.OnlineOrder.first({ id });
        if (!order) throw new NotFoundException('Commande introuvable.');
        if (order.status !== 'CONFIRMED') throw new ConflictException('Seule une commande confirmée peut être convertie en vente.');
        if (order.saleId !== null) {
          const sale = await tx.orm.public.Sale.first({ id: order.saleId });
          if (!sale) throw new ConflictException('La vente liée est introuvable.');
          return { orderId: id, orderReference: order.reference, saleId: sale.id, saleReference: sale.reference, saleStatus: sale.status, convertedAt: order.convertedAt };
        }
        const lines = await tx.orm.public.OnlineOrderLine.where({ orderId: id }).orderBy((line) => line.id.asc()).all();
        if (!lines.length) throw new ConflictException('La commande ne contient aucune ligne.');
        const sale = await this.sales.createDraftInTransaction(tx, {
          reference: `WEB-${order.reference}`, saleDate: businessDate().today,
          customerName: order.customerName, customerPhone: order.customerPhone, notes: order.notes,
          lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unit: line.unitSnapshot, unitSalePrice: line.unitPrice })),
        });
        if (moneyUnits(sale.totalAmount) !== moneyUnits(order.totalAmount) || sale.lines.some((line, index) => moneyUnits(line.lineTotal) !== moneyUnits(lines[index].lineTotal))) throw new ConflictException('Les totaux de la vente ne correspondent pas aux montants de la commande.');
        const convertedAt = new Date().toISOString();
        const linked = await tx.orm.public.OnlineOrder.where({ id }).update({ saleId: sale.id, convertedAt });
        return audited(tx, 'ONLINE_ORDER_CONVERT_TO_SALE', 'ONLINE_ORDER', { orderId: id, orderReference: order.reference, saleId: sale.id, saleReference: sale.reference, saleStatus: sale.status, convertedAt: linked!.convertedAt }, { saleId: sale.id }, id, order.reference);
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) throw new ConflictException('La référence de vente est déjà utilisée ou cette commande possède déjà une vente. Rechargez la commande.');
      if (error instanceof BadRequestException) throw new ConflictException(`Les données historiques ne sont pas compatibles avec les règles de vente actuelles. ${error.message}`);
      throw error;
    }
  }
}
