import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import sharp from 'sharp';
import { readdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { categoryFixture } from './category-fixture.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { AuditModule } from '../src/audit/audit.module.js';
import { AuditService } from '../src/audit/audit.service.js';
import { UsersService } from '../src/auth/users.service.js';
import { CustomerAuthModule } from '../src/customer-auth/customer-auth.module.js';
import { ProductsModule } from '../src/products/products.module.js';
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';
import { ProductImagesModule } from '../src/products/product-images.module.js';
import { MAX_PRODUCT_IMAGE_BYTES } from '../src/products/product-image-storage.js';
import { PublicCatalogueModule } from '../src/public-catalogue/public-catalogue.module.js';
import { PublicCatalogueController } from '../src/public-catalogue/public-catalogue.controller.js';
import { PublicCatalogueService } from '../src/public-catalogue/public-catalogue.service.js';
import { configureHttpSecurity } from '../src/auth/http-security.js';
import type { Role } from '../src/auth/auth-policy.js';
const classification = categoryFixture();
describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Product images (UUID fixtures)', () => {
  const tag = `test-images-${crypto.randomUUID()}`, password = `Aa9-${crypto.randomUUID()}`, origin = 'http://localhost:3000';
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const directory = resolve('../.tmp', tag), previousDirectory = process.env.PRODUCT_IMAGE_DIR;
  const users: number[] = [], ids: number[] = [], cookies = {} as Record<Role, string>;
  let app: INestApplication<App>, png: Buffer, customerCookie: string, imagePath: string;
  const post = (url: string, role: Role = 'ADMIN') => request(app.getHttpServer()).post(url).set('Origin', origin).set('Cookie', cookies[role]);
  const get = (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookies.ADMIN);
  const upload = (id: number, role: Role = 'ADMIN', bytes?: Buffer, filename = 'image.png', contentType = 'image/png') => post(`/products/${id}/image`, role).attach('image', bytes ?? png, { filename, contentType });
  beforeAll(async () => {
    process.env.PRODUCT_IMAGE_DIR = directory;
    png = await sharp({ create: { width: 24, height: 16, channels: 3, background: '#256c45' } }).png().toBuffer();
    Reflect.defineMetadata('design:paramtypes', [ProductsService], ProductsController);
    Reflect.defineMetadata('design:paramtypes', [PublicCatalogueService], PublicCatalogueController);
    const module = await Test.createTestingModule({ imports: [AuthModule, AuditModule, CustomerAuthModule, ProductsModule, ProductImagesModule, PublicCatalogueModule] }).compile();
    app = module.createNestApplication(); app.useLogger(false); configureHttpSecurity(app); await app.init(); await client.connect();
    for (const role of ['ADMIN'] as const) {
      const user = await new UsersService().create({ email: `${tag}-${role.toLowerCase()}@example.test`, fullName: tag, role, isActive: true, password });
      if (!('id' in user)) throw new Error('Missing fixture user'); users.push(user.id);
      const login = await request(app.getHttpServer()).post('/auth/login').set('Origin', origin).send({ email: user.email, password }).expect(200);
      cookies[role] = String(login.headers['set-cookie'][0]).split(';')[0];
    }
    const customer = await request(app.getHttpServer()).post('/public/auth/register').set('Origin', origin).send({ fullName: tag, email: `${tag}@example.test`, phone: '20123456', password }).expect(201);
    customerCookie = String(customer.headers['set-cookie'][0]).split(';')[0];
    for (let index = 0; index < 2; index++) {
      const created = await post('/products').send({ sku: `${tag}-${index}`, name: 'نعناع', productType: 'VRAC', classificationIds: [classification.classificationId], measurementMode: 'FLEXIBLE', storageUnit: 'KG', saleUnit: 'KG', conversionFactor: '1', salePrice: '12.500', isVisibleOnline: true }).expect(201);
      ids.push((created.body as { id: number }).id);
    }
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await client.query('DELETE FROM public.product WHERE id = ANY($1::int[]) AND sku LIKE $2', [ids, tag + '%']);
    await client.query('DELETE FROM public."authSession" WHERE "userId" = ANY($1::int[])', [users]);
    await client.query('DELETE FROM public."user" WHERE id = ANY($1::int[]) AND "fullName" = $2', [users, tag]);
    await client.query('DELETE FROM public.customer WHERE email = $1', [`${tag}@example.test`]); await client.end();
    for (const file of await readdir(directory).catch(() => [] as string[])) await unlink(join(directory, file));
    if (previousDirectory === undefined) delete process.env.PRODUCT_IMAGE_DIR; else process.env.PRODUCT_IMAGE_DIR = previousDirectory;
  });
  it('legacy null image stays readable and arbitrary path writes are rejected', async () => {
    expect((await get(`/products/${ids[0]}`).expect(200)).body.mainImagePath).toBeNull();
    expect((await get(`/public/products/${ids[0]}`).expect(200)).body.mainImagePath).toBeNull();
    await request(app.getHttpServer()).patch(`/products/${ids[0]}`).set('Origin', origin).set('Cookie', cookies.ADMIN).send({ mainImagePath: '/etc/passwd' }).expect(400);
  });
  it('ADMIN uploads after create, static file renders with safe cross-origin headers and public DTO path', async () => {
    const uploaded = await upload(ids[0]); expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(201); imagePath = (uploaded.body as { mainImagePath: string }).mainImagePath;
    expect(imagePath).toMatch(/^\/uploads\/products\/[0-9a-f-]+\.webp$/);
    const image = await request(app.getHttpServer()).get(imagePath).expect(200).expect('Content-Type', /image\/webp/).expect('Cross-Origin-Resource-Policy', 'cross-origin').expect('X-Content-Type-Options', 'nosniff');
    expect((await sharp(image.body as Buffer).metadata()).format).toBe('webp');
    expect((await get(`/public/products/${ids[0]}`)).body.mainImagePath).toBe(imagePath);
    expect((await get(`/public/products?classification=${classification.classificationId}`)).body.data.find((p: { id: number }) => p.id === ids[0]).mainImagePath).toBe(imagePath);
    expect((await readdir(directory)).length).toBe(1);
  });
  it('ADMIN replaces and the previous generated file is removed after commit', async () => {
    const previous = imagePath;
    const jpeg = await sharp(png).jpeg().toBuffer();
    imagePath = (await upload(ids[0], 'ADMIN', jpeg, 'new.jpeg', 'image/jpeg').expect(201)).body.mainImagePath as string;
    expect(imagePath).not.toBe(previous);
    await request(app.getHttpServer()).get(previous).expect(404);
    expect((await readdir(directory)).length).toBe(1);
  });
  it('editing without an image and rejecting replacement preserve the current image', async () => {
    await request(app.getHttpServer()).patch(`/products/${ids[0]}`).set('Origin', origin).set('Cookie', cookies.ADMIN).send({ nameFr: 'Menthe' }).expect(200);
    await upload(ids[0], 'ADMIN', Buffer.from('%PDF not an image'), 'fake.pdf', 'application/pdf').expect(400);
    await upload(ids[0], 'ADMIN', Buffer.from('not a png'), 'fake.png', 'image/png').expect(400);
    await upload(ids[0], 'ADMIN', png, 'fake.svg', 'image/png').expect(400);
    await upload(ids[0], 'ADMIN', png, 'fake.jpg', 'image/jpeg').expect(400);
    await upload(ids[0], 'ADMIN', Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1), 'big.png', 'image/png').expect(413);
    await post(`/products/${ids[0]}/image`).expect(400);
    expect((await get(`/products/${ids[0]}`)).body.mainImagePath).toBe(imagePath);
    await request(app.getHttpServer()).get(imagePath).expect(200);
    expect((await readdir(directory)).length).toBe(1);
  });
  it('Visitor and authenticated customer cannot upload; trusted Origin is required', async () => {
    await request(app.getHttpServer()).post(`/products/${ids[0]}/image`).set('Origin', origin).attach('image', png, 'image.png').expect(401);
    await request(app.getHttpServer()).post(`/products/${ids[0]}/image`).set('Origin', origin).set('Cookie', customerCookie).attach('image', png, 'image.png').expect(401);
    await request(app.getHttpServer()).post(`/products/${ids[0]}/image`).set('Cookie', cookies.ADMIN).attach('image', png, 'image.png').expect(403);
    await upload(2147483647).expect(404);
    expect((await readdir(directory)).length).toBe(1);
  });
  it('rolls back a failed database/audit transaction and cleans its unlinked new file', async () => {
    const failure = vi.spyOn(AuditService, 'record').mockRejectedValueOnce(new Error('Simulated transactional audit failure'));
    try { await upload(ids[0]).expect(500); } finally { failure.mockRestore(); }
    expect((await get(`/products/${ids[0]}`)).body.mainImagePath).toBe(imagePath);
    await request(app.getHttpServer()).get(imagePath).expect(200);
    expect((await readdir(directory)).length).toBe(1);
  });
  it('serves no directories, traversal paths or arbitrary filenames', async () => {
    for (const path of ['/uploads/products', '/uploads/products/.env', '/uploads/products/secret.svg', '/uploads/products/%2e%2e%2f.env']) await request(app.getHttpServer()).get(path).expect(404);
  });
  it('records image replacement in the existing product audit event', async () => {
    const events = await client.query('SELECT "metadataJson" FROM public."auditEvent" WHERE "entityId"=$1 AND action=\'PRODUCT_UPDATE\'', [ids[0]]);
    expect(events.rows.some((row: { metadataJson: { changedFields?: string[] } }) => row.metadataJson.changedFields?.includes('mainImagePath'))).toBe(true);
  });
  it('concurrent replacements leave one referenced file and preserve other product data', async () => {
    const before = (await get(`/products/${ids[0]}`)).body as Record<string, unknown>;
    const results = await Promise.all([upload(ids[0]), upload(ids[0], 'ADMIN')]);
    expect(results.map(r => r.status)).toEqual([201, 201]);
    const after = (await get(`/products/${ids[0]}`)).body as Record<string, unknown>;
    const stable = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => !['mainImagePath', 'updatedAt'].includes(key)));
    expect(stable(after)).toEqual(stable(before)); expect((await readdir(directory)).length).toBe(1);
  });
  it('cleans the generated file after an allowed product deletion', async () => {
    const current = (await get(`/products/${ids[0]}`)).body.mainImagePath as string;
    await request(app.getHttpServer()).delete(`/products/${ids[0]}`).set('Origin', origin).set('Cookie', cookies.ADMIN).expect(200);
    await request(app.getHttpServer()).get(current).expect(404);
    expect((await readdir(directory)).length).toBe(0);
  });
});
