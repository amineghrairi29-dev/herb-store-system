#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6e91f5c26553331f9da6118b3140914d7e98e4444c51335eee893671a40e3b6d/contract';
import endContract from '../../snapshots/6e91f5c26553331f9da6118b3140914d7e98e4444c51335eee893671a40e3b6d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/cac356f8d4f132d4fec6cb0546b90fdca1bee3726a1035738483d1bb5ce99e14/contract';
import startContract from '../../snapshots/cac356f8d4f132d4fec6cb0546b90fdca1bee3726a1035738483d1bb5ce99e14/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
const db = postgres<End>({ contractJson: endContract, url: 'postgresql://localhost/migration-plan' });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'category',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isInternal', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('measurementMode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nameAr', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nameFr', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'category_internal_inactive_1a4cd3b7',
            'NOT "isInternal" OR NOT "isActive"',
          ),
          checkExpression(
            'category_measurement_mode_812f2fa6',
            "\"measurementMode\" IN ('WEIGHT', 'VOLUME', 'WEIGHT_AND_VOLUME', 'FLEXIBLE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'subcategory',
        columns: [
          col('categoryId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('nameAr', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nameFr', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('subcategoryId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('categoryId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dataTransform(endContract, 'seed-initial-categories', {
        check: () => db.raw.sql`SELECT 1 AS id WHERE NOT EXISTS (SELECT 1 FROM public.category)` .returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`INSERT INTO public.category ("nameAr", "nameFr", slug, "measurementMode", "sortOrder", "isActive", "isInternal", "updatedAt") VALUES
          ('أعشاب', 'Herbes', 'herbes', 'WEIGHT', 10, true, false, now()),
          ('زيوت وسوائل طبيعية', 'Huiles et liquides naturels', 'huiles-et-liquides-naturels', 'VOLUME', 20, true, false, now()),
          ('بهارات', 'Épices', 'epices', 'WEIGHT', 30, true, false, now()),
          ('عطورات', 'Parfums', 'parfums', 'WEIGHT_AND_VOLUME', 40, true, false, now()),
          ('الخلطات الخاصة', 'Mélanges spéciaux', 'melanges-speciaux', 'FLEXIBLE', 50, true, false, now()),
          ('غير مصنف', 'À classer (migration)', 'internal-unclassified', 'FLEXIBLE', 2147483647, false, true, now())`.affectedCount().build(),
      }),
      this.dataTransform(endContract, 'seed-initial-subcategories', {
        check: () => db.raw.sql`SELECT 1 AS id WHERE NOT EXISTS (SELECT 1 FROM public.subcategory)`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`INSERT INTO public.subcategory ("categoryId", "nameAr", "nameFr", slug, "sortOrder", "updatedAt")
          SELECT c.id, v.ar, v.fr, v.slug, v.ord, now() FROM public.category c CROSS JOIN (VALUES
          ('زيوت طبيعية', 'Huiles naturelles', 'huiles-naturelles', 10),
          ('مياه طبيعية', 'Eaux naturelles', 'eaux-naturelles', 20)) v(ar, fr, slug, ord)
          WHERE c.slug = 'huiles-et-liquides-naturels'`.affectedCount().build(),
      }),
      this.dataTransform(endContract, 'backfill-product-categoryId', {
        check: () => db.raw.sql`SELECT id FROM public.product WHERE "categoryId" IS NULL LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`UPDATE public.product p SET "categoryId" = COALESCE((
          SELECT c.id FROM public.category c WHERE NOT c."isInternal" AND p.category IN (c."nameAr", c."nameFr")
          AND (c."measurementMode" = 'FLEXIBLE'
            OR (c."measurementMode" = 'WEIGHT' AND p."storageUnit" IN ('G','KG') AND p."saleUnit" IN ('G','KG'))
            OR (c."measurementMode" = 'VOLUME' AND p."storageUnit" IN ('ML','L') AND p."saleUnit" IN ('ML','L'))
            OR (c."measurementMode" = 'WEIGHT_AND_VOLUME' AND p."storageUnit" IN ('G','KG','ML','L') AND p."saleUnit" IN ('G','KG','ML','L')))
          ), (SELECT id FROM public.category WHERE "isInternal")) WHERE p."categoryId" IS NULL`.affectedCount().build(),
      }),
      this.dataTransform(endContract, 'backfill-product-subcategoryId', {
        check: () => db.raw.sql`SELECT p.id FROM public.product p JOIN public.subcategory s ON s."categoryId" = p."categoryId" AND p.subcategory IN (s."nameAr",s."nameFr") WHERE p."subcategoryId" IS NULL LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`UPDATE public.product p SET "subcategoryId" = s.id FROM public.subcategory s WHERE s."categoryId" = p."categoryId" AND p.subcategory IN (s."nameAr",s."nameFr") AND p."subcategoryId" IS NULL`.affectedCount().build(),
      }),
      this.setNotNull({ schema: 'public', table: 'product', column: 'categoryId' }),
      this.addUnique({
        schema: 'public',
        table: 'category',
        constraint: 'category_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'subcategory',
        constraint: 'subcategory_categoryId_slug_key',
        columns: ['categoryId', 'slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'subcategory',
        constraint: 'subcategory_categoryId_id_key',
        columns: ['categoryId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'product',
        index: 'product_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'product',
        index: 'product_categoryId_subcategoryId_idx_956a843b',
        columns: ['categoryId', 'subcategoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'subcategory',
        index: 'subcategory_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'product',
        foreignKey: {
          name: 'product_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'category', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'subcategory',
        foreignKey: {
          name: 'subcategory_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'category', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'product',
        foreignKey: {
          name: 'product_categoryId_subcategoryId_fkey',
          columns: ['categoryId', 'subcategoryId'],
          references: { schema: 'public', table: 'subcategory', columns: ['categoryId', 'id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
