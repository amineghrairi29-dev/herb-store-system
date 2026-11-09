#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48/contract';
import startContract from '../../snapshots/4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cac356f8d4f132d4fec6cb0546b90fdca1bee3726a1035738483d1bb5ce99e14/contract';
import endContract from '../../snapshots/cac356f8d4f132d4fec6cb0546b90fdca1bee3726a1035738483d1bb5ce99e14/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'customer',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fullName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('googleSubject', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('lastLoginAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'customer_email_normalized_0cae2244',
            'email = lower(trim(email)) AND length(email) > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'customerSession',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('customerId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'customer',
        constraint: 'customer_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customer',
        constraint: 'customer_googleSubject_key',
        columns: ['googleSubject'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customerSession',
        constraint: 'customerSession_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerSession',
        index: 'customerSession_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerSession',
        index: 'customerSession_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'onlineOrder',
        index: 'onlineOrder_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customerSession',
        foreignKey: {
          name: 'customerSession_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'customer', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'onlineOrder',
        foreignKey: {
          name: 'onlineOrder_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'customer', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
