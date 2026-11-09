import { BadRequestException, Injectable } from '@nestjs/common';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { convertQuantity, decimalUnits, positiveTypes } from '../stock-movements/stock-decimal.js';
import { catalogue, fields } from './public-catalogue.service.js';
import { cartInput, type CartInput } from './cart-validation.js';
import type { Client } from 'pg';
import type { PublicProductDto } from './public-product.dto.js';

interface CartProductRow extends PublicProductDto { storageUnit: string; conversionFactor: string; derivedStock: string }
@Injectable()
export class PublicCartService {
  async validate(body: unknown) {
    const items = cartInput(body);
    return withPurchaseTransaction(({ client }) => validateCartInTransaction(client, items), true);
  }
}

/** Reused by order creation on its own transaction, never a separate snapshot. */
export async function validateCartInTransaction(client: Client, items: CartInput[]) {
      const result = await client.query<CartProductRow>(`${catalogue} SELECT ${fields}, "storageUnit", "conversionFactor"::text, "derivedStock"::text FROM catalogue WHERE id = ANY($2::int[])`, [positiveTypes, items.map((item) => item.productId)]);
      const products = new Map(result.rows.map((row) => [row.id, row]));
      return { items: items.map((item) => {
        const row = products.get(item.productId);
        if (!row) return { productId: item.productId, valid: false, quantityAvailable: false, availabilityStatus: null, currentPrice: null, product: null, message: 'Produit indisponible' };
        // Internal conversion and stock values never cross the public boundary.
        const { storageUnit, conversionFactor, derivedStock, ...product } = row;
        let quantityAvailable = false, message: string | null = null;
        try {
          const required = decimalUnits(convertQuantity(item.quantity, product.saleUnit, { storageUnit, saleUnit: product.saleUnit, conversionFactor }));
          quantityAvailable = !derivedStock.startsWith('-') && required <= decimalUnits(derivedStock);
          if (!quantityAvailable) message = 'Quantité indisponible. Réduisez la quantité demandée.';
        } catch (error: unknown) {
          if (!(error instanceof BadRequestException)) throw error;
          message = 'Quantité incompatible avec l’unité de vente. Choisissez une autre quantité.';
        }
        if (product.availabilityStatus === 'OUT_OF_STOCK') message = 'Indisponible';
        return { productId: item.productId, valid: quantityAvailable, quantityAvailable, availabilityStatus: product.availabilityStatus, currentPrice: product.salePrice, product, message };
      }) };
}
