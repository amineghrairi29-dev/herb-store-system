import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { CategoriesModule } from '../src/categories/categories.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { AuditModule } from '../src/audit/audit.module.js';
import { UsersService } from '../src/auth/users.service.js';
import { ProductsModule } from '../src/products/products.module.js';
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';
import { PublicCatalogueModule } from '../src/public-catalogue/public-catalogue.module.js';
import { PublicCatalogueController } from '../src/public-catalogue/public-catalogue.controller.js';
import { PublicCatalogueService } from '../src/public-catalogue/public-catalogue.service.js';
import { configureHttpSecurity } from '../src/auth/http-security.js';
import type { Role } from '../src/auth/auth-policy.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Archived category compatibility (owned fixtures)', () => {
  const tag = `test-category-${crypto.randomUUID()}`, password = `Aa9-${crypto.randomUUID()}`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication<App>, sequence = 0;
  const cookies = {} as Record<Role, string>;
  const cats: number[] = [], products: number[] = [], users: number[] = [];
  const origin = 'http://localhost:3000';
  const send = (role: Role, path: string, body: object, method: 'post' | 'patch' = 'post') => request(app.getHttpServer())[method](path).set('Cookie', cookies[role]).set('Origin', origin).send(body);
  const get = (path: string, role: Role = 'ADMIN') => request(app.getHttpServer()).get(path).set('Cookie', cookies[role]);
  async function category(mode = 'WEIGHT', role: Role = 'ADMIN') {
    const response = await send(role, '/categories', { nameAr: 'أعشاب اختبار', nameFr: `${tag}-${++sequence}`, slug: `${tag}-${sequence}`, measurementMode: mode }).expect(201);
    const row = response.body as { id: number; slug: string }; cats.push(row.id); return row;
  }
  beforeAll(async () => {
    Reflect.defineMetadata('design:paramtypes', [ProductsService], ProductsController);
    Reflect.defineMetadata('design:paramtypes', [PublicCatalogueService], PublicCatalogueController);
    const module = await Test.createTestingModule({ imports: [AuthModule, AuditModule, CategoriesModule, ProductsModule, PublicCatalogueModule] }).compile();
    app = module.createNestApplication(); app.useLogger(false); configureHttpSecurity(app); await app.init(); await client.connect();
    for (const role of ['ADMIN'] as const) {
      const user = await new UsersService().create({ email: `${tag}-${role.toLowerCase()}@example.com`, fullName: tag, role, isActive: true, password });
      if (!('id' in user)) throw new Error('Missing fixture user'); users.push(user.id);
      const login = await request(app.getHttpServer()).post('/auth/login').set('Origin', origin).send({ email: user.email, password }).expect(200);
      cookies[role] = String(login.headers['set-cookie'][0]).split(';')[0];
    }
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await client.query('DELETE FROM public."stockMovement" WHERE "productId" = ANY($1::int[])', [products]);
    await client.query('DELETE FROM public.product WHERE id = ANY($1::int[]) AND sku LIKE $2', [products, tag + '%']);
    await client.query('DELETE FROM public.subcategory WHERE "categoryId" = ANY($1::int[])', [cats]);
    await client.query('DELETE FROM public.category WHERE id = ANY($1::int[]) AND slug LIKE $2', [cats, tag + '%']);
    await client.query('DELETE FROM public."authSession" WHERE "userId" = ANY($1::int[])', [users]);
    await client.query('DELETE FROM public."user" WHERE id = ANY($1::int[]) AND "fullName" = $2', [users, tag]);
    await client.end();
  });
  it('ADMIN creates and reads, visitor denied; slug unique and UTF-8', async () => {
    const c = await category('WEIGHT', 'ADMIN');
    expect((await get(`/categories/${c.id}`)).body.nameAr).toBe('أعشاب اختبار');
    await get('/categories', 'ADMIN').expect(200);
    await request(app.getHttpServer()).get('/categories').expect(401);
    await send('ADMIN', '/categories', { nameAr: 'أعشاب', nameFr: 'Herbes', slug: c.slug, measurementMode: 'WEIGHT' }).expect(409);
  });
  it('rejects archived category fields as a substitute for required classifications', async () => {
    await send('ADMIN', '/products', { categoryId: cats[0], name: 'Legacy' }).expect(400);
  });
});
