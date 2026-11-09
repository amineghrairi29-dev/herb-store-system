import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ProductTransaction } from '../prisma/product-transaction.js';
import { validateMovement } from './dto/create-stock-movement.dto.js';
import { aggregateStock, convertQuantity, decimalString, decimalUnits, positiveTypes } from './stock-decimal.js';

/** Caller owns the transaction and must hold the product row lock until commit. */
export async function createMovementInTransaction(tx: ProductTransaction, body: unknown) {
  const input = validateMovement(body);
  const product = await tx.orm.public.Product.first({ id: input.productId });
  if (!product) throw new NotFoundException('Produit introuvable.');
  const quantityInStorageUnit = convertQuantity(input.quantity, input.unit, product);
  const movements = await tx.orm.public.StockMovement.where({ productId: product.id }).all();
  const stock = aggregateStock(movements);
  if (!positiveTypes.includes(input.type) && decimalUnits(quantityInStorageUnit) > stock) {
    throw new ConflictException(`Stock insuffisant : ${decimalString(stock)} ${product.storageUnit} disponible.`);
  }
  return tx.orm.public.StockMovement.create({ ...input, quantityInStorageUnit });
}
