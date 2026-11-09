import { ConflictException } from '@nestjs/common';
import type { PurchaseTransaction } from '../purchases/purchase-transaction.js';

export const lockIdentityEmails = (tx: PurchaseTransaction) =>
  tx.client.query('SELECT pg_advisory_xact_lock(724001, 2)');

// Reserve inactive identities too: unified login deliberately fails closed on ambiguity.
export async function availableEmail(tx: PurchaseTransaction, email: string, kind?: 'ADMIN' | 'CUSTOMER', id?: number) {
  const result = await tx.client.query(
    `SELECT 1 FROM public."user" WHERE lower(trim(email))=$1 AND NOT ($2='ADMIN' AND id=$3)
     UNION ALL SELECT 1 FROM public.customer WHERE lower(trim(email))=$1 AND NOT ($2='CUSTOMER' AND id=$3)`,
    [email, kind ?? '', id ?? -1],
  );
  if (result.rows.length) throw new ConflictException('Modification impossible. Vérifiez les informations saisies.');
}
