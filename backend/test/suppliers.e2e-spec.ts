import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../src/prisma/contract.d';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import { SuppliersController } from '../src/suppliers/suppliers.controller.js';
import { SuppliersService } from '../src/suppliers/suppliers.service.js';

const harness = vi.hoisted(() => ({ db: undefined as Pick<typeof import('../src/prisma/db.js').db, 'orm'> | undefined }));
vi.mock('../src/prisma/db.js', () => ({ get db() {
  if (!harness.db) throw new Error('Database access outside the supplier test transaction is forbidden.');
  return harness.db;
} }));

vi.mock('../src/purchases/purchase-transaction.js', () => ({
  withPurchaseTransaction: async <T>(work: (tx: object) => Promise<T>) => {
    if (!harness.db) throw new Error('Database access outside the supplier test transaction is forbidden.');
    // Row-lock concurrency is tested separately; this harness owns one rollback-only ORM transaction.
    return work({ ...harness.db, client: { query: async () => ({ rows: [] }) } });
  },
}));
describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Suppliers HTTP integration (rolled back)', () => {
  it('creates, reads, updates, deactivates, reactivates and validates without retaining suppliers', async () => {
    const database = postgres<Contract>({ contractJson, url: process.env.DATABASE_URL! });
    const rollback = new Error('Intentional supplier test rollback');
    const code = `TEST-SUP-${crypto.randomUUID()}`;
    let app: INestApplication<App> | undefined;
    try {
      await expect(database.transaction(async (tx) => {
        harness.db = tx;
        Reflect.defineMetadata('design:paramtypes', [SuppliersService], SuppliersController);
        const module = await Test.createTestingModule({ controllers: [SuppliersController], providers: [SuppliersService] }).compile();
        app = module.createNestApplication(); await app.init();
        const server = app.getHttpServer();
        const input = { code, name: 'مورد الأطلس', contactName: 'أحمد', email: 'atlas@example.com', phone: '22111222', city: 'Tunis', country: 'Tunisie', address: 'Rue 1', taxId: null, notes: null };
        await request(server).post('/suppliers').send({ ...input, email: 'invalid' }).expect(400);
        const created = await request(server).post('/suppliers').send(input).expect(201);
        const body: unknown = created.body;
        if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'number') throw new Error('Missing supplier ID');
        expect(body).toMatchObject({ ...input, isActive: true, createdAt: expect.any(String), updatedAt: expect.any(String) });
        const path = `/suppliers/${body.id}`;
        expect((await request(server).get(path).expect(200)).body).toMatchObject(input);
        expect((await request(server).get('/suppliers').expect(200)).body).toEqual(expect.arrayContaining([expect.objectContaining(input)]));
        const duplicate = await request(server).post('/suppliers').send(input).expect(409);
        expect(duplicate.body).toMatchObject({ message: 'Ce code fournisseur est déjà utilisé.' });
        await request(server).post('/suppliers').send({ code: `${code}-2`, name: 'Second' }).expect(201);
        await request(server).patch(path).send({ code: `${code}-2` }).expect(409);
        await request(server).patch(path).send({ email: 'invalid' }).expect(400);
        const edited = await request(server).patch(path).send({ name: 'مورد معدل', contactName: 'فاطمة', email: null, notes: 'Mise à jour', isActive: false }).expect(200);
        expect(edited.body).toMatchObject({ name: 'مورد معدل', contactName: 'فاطمة', email: null, isActive: false });
        if ('updatedAt' in body) expect(edited.body).not.toMatchObject({ updatedAt: body.updatedAt });
        expect((await request(server).patch(path).send({ isActive: true }).expect(200)).body).toMatchObject({ isActive: true });
        await request(server).get('/suppliers/2147483647').expect(404);
        await request(server).patch('/suppliers/2147483647').send({ isActive: false }).expect(404);
        await request(server).get('/suppliers/0').expect(400);
        await app.close(); app = undefined;
        throw rollback;
      })).rejects.toBe(rollback);
      expect(await database.orm.public.Supplier.first({ code })).toBeNull();
      expect(await database.orm.public.Supplier.first({ code: `${code}-2` })).toBeNull();
    } finally { await app?.close(); harness.db = undefined; await database.close(); }
  }, 20000);
});
