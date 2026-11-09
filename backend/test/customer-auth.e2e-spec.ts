import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { AppModule } from '../src/app.module.js';
import { configureHttpSecurity } from '../src/auth/http-security.js';
import { CustomerAuthService } from '../src/customer-auth/customer-auth.service.js';
import { GoogleAuthService } from '../src/customer-auth/google-auth.service.js';
import { PublicCatalogueController } from '../src/public-catalogue/public-catalogue.controller.js';
import { PublicCatalogueService } from '../src/public-catalogue/public-catalogue.service.js';
import { PublicCartController } from '../src/public-catalogue/public-cart.controller.js';
import { PublicCartService } from '../src/public-catalogue/public-cart.service.js';
import { UsersService } from '../src/auth/users.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')(
  'Customer auth, checkout enforcement and isolation',
  () => {
    const tag = 'customer-test-' + crypto.randomUUID(),
      email = tag + '@example.test',
      password = 'Aa9-' + crypto.randomUUID(),
      origin = 'http://localhost:3000';
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    let app: INestApplication<App>,
      cookie: string,
      customerId: number,
      productId: number;
    const post = (path: string) =>
      request(app.getHttpServer()).post(path).set('Origin', origin);
    const cookieOf = (r: { headers: Record<string, unknown> }) =>
      String((r.headers['set-cookie'] as string[])[0]).split(';')[0];
    const order = () => ({
      deliveryAddress: '12 rue des Plantes',
      customerName: tag,
      customerPhone: '20123456',
      customerEmail: email,
      items: [{ productId, quantity: '1' }],
    });
    beforeAll(async () => {
      Reflect.defineMetadata(
        'design:paramtypes',
        [PublicCatalogueService],
        PublicCatalogueController,
      );
      Reflect.defineMetadata(
        'design:paramtypes',
        [PublicCartService],
        PublicCartController,
      );
      const mod = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = mod.createNestApplication();
      app.useLogger(false);
      configureHttpSecurity(app);
      await app.init();
      await db.connect();
      productId = (
        await db.query<{ id: number }>(
          `INSERT INTO public.product ("categoryId",sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","updatedAt") VALUES (${classification.id},$1,$1,'VRAC',12.5,$1,'KG','KG',1,true,true,true,now()) RETURNING id`,
          [tag],
        )
      ).rows[0].id;
      await classification.link(db, productId);
      await db.query(
        `INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit") VALUES ($1,'ENTRY',10,'KG',10)`,
        [productId],
      );
    }, 30000);
    afterAll(async () => {
      await db.query(
        'DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName"=$1)',
        [tag],
      );
      await db.query(
        'DELETE FROM public."onlineOrder" WHERE "customerName"=$1',
        [tag],
      );
      await db.query(
        'DELETE FROM public."stockMovement" WHERE "productId"=$1',
        [productId],
      );
      await db.query('DELETE FROM public.product WHERE id=$1', [productId]);
      await db.query('DELETE FROM public.customer WHERE email LIKE $1', [
        tag + '%',
      ]);
      await db.query('DELETE FROM public."user" WHERE email=$1', [tag + '-internal@example.test']);
      await db.end();
      await app?.close();
    });
    it('keeps catalogue/cart public and rejects visitor order creation', async () => {
      await request(app.getHttpServer()).get('/public/products').expect(200);
      await post('/public/cart/validate')
        .send({ items: [{ productId, quantity: '1' }] })
        .expect(200);
      await post('/public/orders').send(order()).expect(401);
      await post('/public/auth/register')
        .set('Origin', 'https://evil.test')
        .send({ email, password })
        .expect(403);
      await request(app.getHttpServer())
        .post('/public/auth/register')
        .send({ email, password })
        .expect(403);
    });
    it('rejects weak passwords and normalizes registration without exposing hashes', async () => {
      await post('/public/auth/register')
        .send({ email, password: 'weak' })
        .expect(400);
      const r = await post('/public/auth/register')
        .send({
          email: ' ' + email.toUpperCase() + ' ',
          password,
          fullName: 'عميل Test',
          phone: '20123456',
        })
        .expect(201);
      cookie = cookieOf(r);
      customerId = r.body.id;
      expect(r.body).toEqual({
        id: customerId,
        email,
        fullName: 'عميل Test',
        phone: '20123456',
        deliveryAddress: null,
      });
      expect(String(r.headers['set-cookie'])).toContain('HttpOnly');
      expect(String(r.headers['set-cookie'])).toContain('SameSite=Lax');
      expect(
        (
          await db.query(
            'SELECT "passwordHash" FROM public.customer WHERE id=$1',
            [customerId],
          )
        ).rows[0].passwordHash,
      ).not.toBe(password);
      await post('/public/auth/register').send({ email, password }).expect(409);
      await request(app.getHttpServer())
        .get('/public/auth/me')
        .set('Cookie', cookie)
        .expect(200);
    });
    it('updates only the signed-in customer profile and preserves credentials', async () => {
      const profile = { fullName: 'عميل Test', phone: '20987654', deliveryAddress: '12 rue des Plantes، تونس' };
      const credentials = (await db.query('SELECT email,"passwordHash","googleSubject","isActive" FROM public.customer WHERE id=$1', [customerId])).rows[0];
      const others = (await db.query('SELECT jsonb_agg(c ORDER BY id) AS data FROM public.customer c WHERE id<>$1', [customerId])).rows[0];
      const patch = () => request(app.getHttpServer()).patch('/public/auth/profile').set('Origin', origin).set('Cookie', cookie);
      await request(app.getHttpServer()).patch('/public/auth/profile').set('Origin', origin).send(profile).expect(401);
      await request(app.getHttpServer()).patch('/public/auth/profile').set('Cookie', cookie).send(profile).expect(403);
      for (const extra of [{ email: 'other@example.test' }, { id: 1 }, { role: 'ADMIN' }, { fullName: ' ' }, { deliveryAddress: 'x'.repeat(501) }]) await patch().send({ ...profile, ...extra }).expect(400);
      const result = await patch().send(profile).expect(200);
      expect(result.body).toEqual({ id: customerId, email, ...profile });
      const me = await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body).toEqual(result.body);
      expect((await db.query('SELECT email,"passwordHash","googleSubject","isActive" FROM public.customer WHERE id=$1', [customerId])).rows[0]).toEqual(credentials);
      expect((await db.query('SELECT jsonb_agg(c ORDER BY id) AS data FROM public.customer c WHERE id<>$1', [customerId])).rows[0]).toEqual(others);
      await patch().send({ fullName: 'عميل Test', phone: '20123456', deliveryAddress: '' }).expect(200);
    });
    it('uses generic login errors, rejects inactive customers, rotates and logs out sessions', async () => {
      const a = await post('/public/auth/login')
          .send({ email, password: 'wrong' })
          .expect(401),
        b = await post('/public/auth/login')
          .send({ email: 'missing@test.local', password })
          .expect(401);
      expect(a.body).toEqual(b.body);
      await db.query(
        'UPDATE public.customer SET "isActive"=false WHERE id=$1',
        [customerId],
      );
      await post('/public/auth/login').send({ email, password }).expect(401);
      await request(app.getHttpServer())
        .get('/public/auth/me')
        .set('Cookie', cookie)
        .expect(401);
      await db.query('UPDATE public.customer SET "isActive"=true WHERE id=$1', [
        customerId,
      ]);
      const old = cookie;
      cookie = cookieOf(
        await post('/public/auth/login')
          .set('Cookie', cookie)
          .send({ email, password })
          .expect(200),
      );
      await request(app.getHttpServer())
        .get('/public/auth/me')
        .set('Cookie', old)
        .expect(401);
      await post('/public/auth/logout').set('Cookie', cookie).expect(200);
      await request(app.getHttpServer())
        .get('/public/auth/me')
        .set('Cookie', cookie)
        .expect(401);
      cookie = cookieOf(
        await post('/public/auth/login').send({ email, password }).expect(200),
      );
    });
    it('takes customerId only from the session and preserves contact/price snapshots without deducting stock', async () => {
      await post('/public/orders')
        .set('Cookie', cookie)
        .send({ ...order(), customerId: 999 })
        .expect(400);
      const response = await post('/public/orders')
        .set('Cookie', cookie)
        .send(order())
        .expect(201);
      const row = (
        await db.query(
          'SELECT * FROM public."onlineOrder" WHERE reference=$1',
          [response.body.reference],
        )
      ).rows[0];
      expect(row.customerId).toBe(customerId);
      expect(row.customerEmail).toBe(email);
      expect(row.customerName).toBe(tag);
      expect(row.totalAmount).toBe('12.500');
      await db.query('UPDATE public.customer SET "fullName"=$1 WHERE id=$2', [
        'Changed profile',
        customerId,
      ]);
      expect(
        (
          await db.query(
            'SELECT "customerName" FROM public."onlineOrder" WHERE id=$1',
            [row.id],
          )
        ).rows[0].customerName,
      ).toBe(tag);
      await request(app.getHttpServer())
        .get('/public/orders/' + row.reference)
        .query({ phone: '20123456' })
        .expect(200);
      expect(
        (
          await db.query(
            'SELECT count(*)::int AS count FROM public."stockMovement" WHERE "productId"=$1',
            [productId],
          )
        ).rows[0].count,
      ).toBe(1);
    });
    it('customer cookies cannot authorize any back-office domain, even renamed', async () => {
      for (const path of [
        '/products',
        '/categories',
        '/classifications',
        '/dashboard',
        '/suppliers',
        '/cash/summary',
        '/expenses',
        '/stock-movements',
        '/purchases',
        '/sales',
        '/finance/summary',
        '/reports/sales',
        '/users',
        '/audit-events',
        '/settings/store',
        '/online-orders',
        '/auth/me',
      ])
        await request(app.getHttpServer())
          .get(path)
          .set('Cookie', cookie)
          .expect(401);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie.replace('herb_customer=', 'herb_session='))
        .expect(401);
      const user = await new UsersService().create({
        email: tag + '-internal@example.test',
        password,
        fullName: tag,
        role: 'ADMIN',
        isActive: true,
      });
      expect(user).toHaveProperty('id');
      const staff = cookieOf(
        await post('/auth/login').send({ email: tag + '-internal@example.test', password }).expect(200),
      );
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', staff)
        .expect(200);
      await request(app.getHttpServer())
        .get('/public/auth/me')
        .set('Cookie', staff)
        .expect(401);
      await post('/public/orders')
        .set('Cookie', staff)
        .send(order())
        .expect(401);
    });
    it('completes the Google callback with a customer-only cookie and checkout redirect', async () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-secret');
      vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3001/public/auth/google/callback');
      const google = app.get(GoogleAuthService);
      // Provider exchange is mocked; signed JWT verification has separate cryptographic tests.
      const finish = vi.spyOn(google, 'finish').mockResolvedValue({ sub: tag + '-callback', email: tag + '-callback@gmail.com', authoritative: true });
      try {
        const start = await request(app.getHttpServer()).get('/public/auth/google/start?returnTo=/shop/checkout').expect(302);
        const state = new URL(String(start.headers.location)).searchParams.get('state');
        const callback = await request(app.getHttpServer()).get('/public/auth/google/callback').query({ state, code: 'test-code' }).set('Cookie', cookieOf(start)).expect(302);
        expect(callback.headers.location).toBe(origin + '/shop/checkout');
        const cookies = callback.headers['set-cookie'] as unknown as string[];
        const customerCookie = cookies.find(value => value.startsWith('herb_customer='))!.split(';')[0];
        const me = await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', customerCookie).expect(200);
        expect(me.body.email).toBe(tag + '-callback@gmail.com');
        expect(me.body).not.toHaveProperty('googleSubject');
        await request(app.getHttpServer()).get('/auth/me').set('Cookie', customerCookie).expect(401);
        await post('/public/auth/logout').set('Cookie', customerCookie).expect(200);
        await request(app.getHttpServer()).get('/public/auth/me').set('Cookie', customerCookie).expect(401);
      } finally { finish.mockRestore(); vi.unstubAllEnvs(); }
    });
    it('creates/links verified Google identities once, revoking unverified local credentials on authoritative linking', async () => {
      const service = app.get(CustomerAuthService),
        googleEmail = tag + '-google@gmail.com';
      const initial = await service.register({ email: googleEmail, password });
      await service.updateProfile(initial.customer.id, { fullName: 'Google Profile Test', phone: '20987654', deliveryAddress: '12 rue des Plantes' });
      const identity = { sub: tag, email: googleEmail, authoritative: true };
      const linked = await service.google(identity);
      expect(linked.customer.id).toBe(initial.customer.id);
      expect(await service.current(linked.token)).toMatchObject({ fullName: 'Google Profile Test', phone: '20987654', deliveryAddress: '12 rue des Plantes' });
      await expect(service.current(initial.token)).rejects.toThrow();
      await expect(
        service.login({ email: googleEmail, password }),
      ).rejects.toThrow();
      expect((await service.google(identity)).customer.id).toBe(
        linked.customer.id,
      );
      await expect(
        service.google({ ...identity, sub: 'other' }),
      ).rejects.toThrow();
      await expect(
        service.google({ sub: tag + 'external', email, authoritative: false }),
      ).rejects.toThrow();
      const fresh = await service.google({
        sub: tag + 'fresh',
        email: tag + '-fresh@gmail.com',
        authoritative: true,
      });
      expect(fresh.customer.email).toContain('-fresh@');
      expect((await service.current(fresh.token)).id).toBe(fresh.customer.id);
      await service.logout(fresh.token);
      await expect(service.current(fresh.token)).rejects.toThrow();
      expect(
        (
          await db.query(
            'SELECT count(*)::int AS count FROM public.customer WHERE email=$1',
            [googleEmail],
          )
        ).rows[0].count,
      ).toBe(1);
    });
  },
);
