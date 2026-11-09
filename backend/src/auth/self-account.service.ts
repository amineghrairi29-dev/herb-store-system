import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { withPurchaseTransaction, type PurchaseTransaction } from '../purchases/purchase-transaction.js';
import { tokenHash } from './auth.service.js';
import { emailValue, nameValue, objectBody, passwordValue } from './user-validation.js';
import { availableEmail, lockIdentityEmails } from './identity-email.js';
import { audited } from '../audit/audit.service.js';

type Kind = 'ADMIN' | 'CUSTOMER';
const tables = {
  ADMIN: { account: '"user"', sessions: '"authSession"', owner: '"userId"', prefix: '' },
  CUSTOMER: { account: 'customer', sessions: '"customerSession"', owner: '"customerId"', prefix: 'customer:' },
} as const;
interface Row { id: number; email: string; passwordHash: string | null; role?: string; isActive: boolean; }
const invalid = () => new BadRequestException('Modification impossible. Vérifiez les informations saisies.');

@Injectable()
export class SelfAccountService {
  private async current(tx: PurchaseTransaction, kind: Kind, id: number, token?: string) {
    if (!token) throw new UnauthorizedException('Authentification requise.');
    const table = tables[kind];
    // Same row lock as login: concurrent password changes/logins cannot leave stale sessions.
    const row = (await tx.client.query<Row>(`SELECT * FROM public.${table.account} WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    const digest = tokenHash(table.prefix + token);
    const session = await tx.client.query(`SELECT 1 FROM public.${table.sessions} WHERE ${table.owner}=$1 AND "tokenHash"=$2 AND "expiresAt">now()`, [id, digest]);
    if (!row?.isActive || (kind === 'ADMIN' && row.role !== 'ADMIN') || !session.rows.length)
      throw new UnauthorizedException('Authentification requise.');
    return { row, digest, table };
  }
  async security(kind: Kind, id: number, token?: string) {
    return withPurchaseTransaction(async tx => ({ hasPassword: !!(await this.current(tx, kind, id, token)).row.passwordHash }));
  }
  async profile(id: number, token: string | undefined, body: unknown) {
    const data = objectBody(body, ['fullName']);
    const fullName = nameValue(data.fullName);
    return withPurchaseTransaction(async tx => {
      await this.current(tx, 'ADMIN', id, token);
      await tx.client.query('UPDATE public."user" SET "fullName"=$1,"updatedAt"=now() WHERE id=$2', [fullName, id]);
      return audited(tx, 'USER_UPDATE', 'USER', { success: true }, { changedFields: ['fullName'] }, id);
    });
  }
  async change(kind: Kind, id: number, token: string | undefined, operation: 'email' | 'password', body: unknown) {
    const data = objectBody(body, operation === 'email' ? ['email', 'currentPassword'] : ['currentPassword', 'newPassword', 'confirmPassword']);
    if (typeof data.currentPassword !== 'string' || !data.currentPassword || Buffer.byteLength(data.currentPassword) > 72) throw invalid();
    const currentPassword = data.currentPassword;
    let email: string | undefined, password: string | undefined;
    try {
      if (operation === 'email') email = emailValue(data.email);
      else {
        password = passwordValue(data.newPassword);
        if (password !== data.confirmPassword) throw invalid();
      }
    } catch { throw invalid(); }
    return withPurchaseTransaction(async tx => {
      if (email) await lockIdentityEmails(tx);
      const { row, digest, table } = await this.current(tx, kind, id, token);
      if (!row.passwordHash || !await compare(currentPassword, row.passwordHash)) throw invalid();
      if (email) {
        await availableEmail(tx, email, kind, id);
        // Changing the login email disconnects the old Google identity; no tokens are retained.
        const unlink = kind === 'CUSTOMER' && email !== row.email ? ',"googleSubject"=NULL' : '';
        await tx.client.query(`UPDATE public.${table.account} SET email=$1,"updatedAt"=now()${unlink} WHERE id=$2`, [email, id]);
      } else {
        const passwordHash = await hash(password!, 12);
        await tx.client.query(`UPDATE public.${table.account} SET "passwordHash"=$1,"updatedAt"=now() WHERE id=$2`, [passwordHash, id]);
      }
      await tx.client.query(`DELETE FROM public.${table.sessions} WHERE ${table.owner}=$1 AND "tokenHash"<>$2`, [id, digest]);
      if (kind === 'ADMIN') return audited(tx, operation === 'email' ? 'USER_UPDATE' : 'USER_PASSWORD_CHANGE', 'USER', { success: true }, { changedFields: [operation] }, id);
      return { success: true };
    });
  }
}
