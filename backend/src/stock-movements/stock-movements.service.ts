import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { withProductTransaction } from '../prisma/product-transaction.js';
import { validateMovement } from './dto/create-stock-movement.dto.js';
import { aggregateStock, decimalString } from './stock-decimal.js';
import { createMovementInTransaction } from './create-movement-in-transaction.js';
import { audited } from '../audit/audit.service.js';
import type { AuditAction } from '../audit/audit-values.js';

@Injectable()
export class StockMovementsService {
  async create(body: unknown) {
    const input = validateMovement(body);
    return withProductTransaction(input.productId, async tx => audited(tx, `STOCK_${input.type}_CREATE` as AuditAction, 'STOCK_MOVEMENT', await createMovementInTransaction(tx, input), { movementType: input.type, productId: input.productId }));
  }

  findAll() {
    return db.orm.public.StockMovement.orderBy((movement) => movement.id.desc()).all();
  }

  async findOne(id: number) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new BadRequestException('Identifiant de mouvement invalide.');
    const movement = await db.orm.public.StockMovement.first({ id });
    if (!movement) throw new NotFoundException('Mouvement introuvable.');
    return movement;
  }

  async stock(productId: number) {
    return withProductTransaction(productId, async (tx) => {
      const product = await tx.orm.public.Product.first({ id: productId });
      if (!product) throw new NotFoundException('Produit introuvable.');
      const movements = await tx.orm.public.StockMovement.where({ productId }).all();
      return { productId, stock: decimalString(aggregateStock(movements)), unit: product.storageUnit };
    });
  }
}
