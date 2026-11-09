#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7d9773f7979953668848d3d7fcd89e8b5ea1e096ad1a1338b3982dfa4878aabf/contract';
import endContract from '../../snapshots/7d9773f7979953668848d3d7fcd89e8b5ea1e096ad1a1338b3982dfa4878aabf/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8ab10b36394f541c76375e840ed7008106b1ea340786b4675e97efc3fae45c7a/contract';
import startContract from '../../snapshots/8ab10b36394f541c76375e840ed7008106b1ea340786b4675e97efc3fae45c7a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

import postgres from '@prisma/orm-postgres/runtime';
const db = postgres<End>({ contractJson: endContract, url: 'postgresql://localhost/migration-plan' });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'classification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imagePath', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('legacyCategoryId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('legacySubcategoryId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('nameAr', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
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
      this.createTable({
        schema: 'public',
        table: 'productClassification',
        columns: [
          col('classificationId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('measurementMode', 'text', {
          notNull: true,
          default: lit('FLEXIBLE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.dropNotNull({ schema: 'public', table: 'product', column: 'categoryId' }),
      this.addUnique({
        schema: 'public',
        table: 'classification',
        constraint: 'classification_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'classification',
        constraint: 'classification_legacyCategoryId_key',
        columns: ['legacyCategoryId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'classification',
        constraint: 'classification_legacySubcategoryId_key',
        columns: ['legacySubcategoryId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_measurement_mode_812f2fa6',
        expression: "\"measurementMode\" IN ('WEIGHT', 'VOLUME', 'WEIGHT_AND_VOLUME', 'FLEXIBLE')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'productClassification',
        constraint: 'productClassification_productId_classificationId_key',
        columns: ['productId', 'classificationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'productClassification',
        index: 'productClassification_classificationId_idx_d71156a6',
        columns: ['classificationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'productClassification',
        index: 'productClassification_classificationId_productId_idx_df17f70e',
        columns: ['classificationId', 'productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'productClassification',
        index: 'productClassification_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'productClassification',
        foreignKey: {
          name: 'productClassification_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'productClassification',
        foreignKey: {
          name: 'productClassification_classificationId_fkey',
          columns: ['classificationId'],
          references: { schema: 'public', table: 'classification', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.dataTransform(endContract, 'copy-categories', {
        check: () => db.raw.sql`SELECT id FROM public.category WHERE id NOT IN (SELECT "legacyCategoryId" FROM public.classification WHERE "legacyCategoryId" IS NOT NULL) LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`INSERT INTO public.classification ("nameFr","nameAr",slug,"imagePath","isActive","sortOrder","legacyCategoryId","createdAt","updatedAt") SELECT "nameFr","nameAr",slug,"imagePath",("isActive" AND NOT "isInternal"),"sortOrder",id,"createdAt","updatedAt" FROM public.category ON CONFLICT ("legacyCategoryId") DO NOTHING`.affectedCount().build(),
      }),
      this.dataTransform(endContract, 'copy-subcategories', {
        check: () => db.raw.sql`SELECT id FROM public.subcategory WHERE id NOT IN (SELECT "legacySubcategoryId" FROM public.classification WHERE "legacySubcategoryId" IS NOT NULL) LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`INSERT INTO public.classification ("nameFr","nameAr",slug,"isActive","sortOrder","legacySubcategoryId","createdAt","updatedAt") SELECT s."nameFr",s."nameAr",'legacy-subcategory-'||s.id||'-'||md5(s.slug),(s."isActive" AND c."isActive" AND NOT c."isInternal"),s."sortOrder",s.id,s."createdAt",s."updatedAt" FROM public.subcategory s JOIN public.category c ON c.id=s."categoryId" ON CONFLICT ("legacySubcategoryId") DO NOTHING`.affectedCount().build(),
      }),
      this.dataTransform(endContract, 'link-existing-products', {
        check: () => db.raw.sql`SELECT id FROM public.product p WHERE NOT EXISTS (SELECT 1 FROM public."productClassification" pc WHERE pc."productId"=p.id) LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`INSERT INTO public."productClassification" ("productId","classificationId") SELECT p.id,c.id FROM public.product p JOIN public.classification c ON c."legacyCategoryId"=p."categoryId" OR c."legacySubcategoryId"=p."subcategoryId" ON CONFLICT ("productId","classificationId") DO NOTHING`.affectedCount().build(),
      }),
      this.dataTransform(endContract, 'move-measurement-to-product', {
        check: () => db.raw.sql`SELECT p.id FROM public.product p JOIN public.category c ON c.id=p."categoryId" WHERE p."measurementMode"<>c."measurementMode" LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`UPDATE public.product p SET "measurementMode"=c."measurementMode" FROM public.category c WHERE c.id=p."categoryId"`.affectedCount().build(),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
