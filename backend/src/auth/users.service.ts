import { availableEmail, lockIdentityEmails } from './identity-email.js';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { withPurchaseTransaction, type PurchaseTransaction } from '../purchases/purchase-transaction.js';
import { purchaseId } from '../purchases/purchase-validation.js';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';
import { safeUser } from './auth-policy.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';
import { activeValue, emailValue, nameValue, objectBody, passwordValue, roleValue } from './user-validation.js';
// Serialize security mutations, including bootstrap, to protect the last active admin.
export const lockUsers = (tx: PurchaseTransaction) => tx.client.query('SELECT pg_advisory_xact_lock(724001, 1)');
@Injectable()
export class UsersService {
  private async detail(tx: PurchaseTransaction, id: number) {
    const row = await tx.orm.public.User.first({ id }); if (!row) throw new NotFoundException('Utilisateur introuvable.');
    return { ...safeUser(row), isActive: row.isActive, lastLoginAt: row.lastLoginAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }
  list() { return withPurchaseTransaction(async tx => tx.orm.public.User.select('id', 'fullName', 'email', 'role', 'isActive', 'lastLoginAt', 'createdAt', 'updatedAt').orderBy(u => u.id.asc()).all(), true); }
  findOne(id: number) { purchaseId(id); return withPurchaseTransaction(tx => this.detail(tx, id), true); }
  async create(value: unknown, bootstrap = false) {
    const body = objectBody(value, ['email', 'fullName', 'role', 'password', 'isActive']);
    const input = { email: emailValue(body.email), fullName: nameValue(body.fullName), role: roleValue(body.role), isActive: body.isActive === undefined ? true : activeValue(body.isActive), passwordHash: await hash(passwordValue(body.password), 12) };
    try { return await withPurchaseTransaction(async tx => {
      await lockUsers(tx);
      if (bootstrap) {
        if (await tx.orm.public.User.first({ email: input.email })) return { created: false, message: 'Email déjà présent : aucun compte modifié.' };
        if (await tx.orm.public.User.first({ role: 'ADMIN', isActive: true })) return { created: false, message: 'Un administrateur actif existe déjà : aucun compte créé.' };
      }
      await lockIdentityEmails(tx);
      await availableEmail(tx, input.email);
      const user = await tx.orm.public.User.create(input); return audited(tx, 'USER_CREATE', 'USER', await this.detail(tx, user.id));
    }); } catch (error: unknown) { if (isUniqueViolation(error)) throw new ConflictException('Cette adresse email est déjà utilisée.'); throw error; }
  }
  async update(id: number, value: unknown, actorId: number) {
    purchaseId(id); const body = objectBody(value, ['fullName', 'role', 'isActive']);
    const data = { ...(body.fullName !== undefined ? { fullName: nameValue(body.fullName) } : {}), ...(body.role !== undefined ? { role: roleValue(body.role) } : {}), ...(body.isActive !== undefined ? { isActive: activeValue(body.isActive) } : {}) };
    return withPurchaseTransaction(async tx => {
      await lockUsers(tx); const user = await tx.orm.public.User.first({ id }); if (!user) throw new NotFoundException('Utilisateur introuvable.');
      if (actorId === id && data.isActive === false) throw new ConflictException('Vous ne pouvez pas désactiver votre propre compte.');
      if (user.role === 'ADMIN' && user.isActive && (data.isActive === false || (data.role && data.role !== 'ADMIN'))) {
        const admins = await tx.orm.public.User.where({ role: 'ADMIN', isActive: true }).all();
        if (admins.length <= 1) throw new ConflictException('Impossible de supprimer le dernier administrateur actif.');
      }
      if (data.isActive === true) { await lockIdentityEmails(tx); await availableEmail(tx, user.email, 'ADMIN', id); }
      await tx.orm.public.User.where({ id }).update(data);
      if (data.role !== undefined && data.role !== user.role || data.isActive !== undefined && data.isActive !== user.isActive) await tx.client.query('DELETE FROM public."authSession" WHERE "userId" = $1', [id]);
      const action = data.role !== undefined && data.role !== user.role ? 'USER_ROLE_CHANGE' : data.isActive !== undefined && data.isActive !== user.isActive ? (data.isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE') : 'USER_UPDATE';
      return audited(tx, action, 'USER', await this.detail(tx, id), { changedFields: changedFields(data), roleBefore: user.role, roleAfter: data.role ?? user.role, activeBefore: user.isActive, activeAfter: data.isActive ?? user.isActive });
    });
  }
  async password(id: number, value: unknown) {
    purchaseId(id); const body = objectBody(value, ['password']), passwordHash = await hash(passwordValue(body.password), 12);
    return withPurchaseTransaction(async tx => { await lockUsers(tx); await this.detail(tx, id); await tx.orm.public.User.where({ id }).update({ passwordHash }); await tx.client.query('DELETE FROM public."authSession" WHERE "userId" = $1', [id]); return audited(tx, 'USER_PASSWORD_CHANGE', 'USER', { success: true }, undefined, id); });
  }
}
