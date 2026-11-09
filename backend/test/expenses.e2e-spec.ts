import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { ExpensesController } from '../src/expenses/expenses.controller.js';
import { ExpensesService } from '../src/expenses/expenses.service.js';
import { CashController } from '../src/cash/cash.controller.js';
import { CashService } from '../src/cash/cash.service.js';
import * as expenseCash from '../src/expenses/expense-cash.js';
import { moneyUnits } from '../src/purchases/purchase-validation.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Expenses HTTP (disposable fixtures)', () => {
  const token = `TEST-EXP-${crypto.randomUUID()}`;
  let app: INestApplication<App>, sequence = 0, originalStock: unknown;
  const data = (extra: Record<string, unknown> = {}) => ({ reference: `${token}-${++sequence}`, category: 'RENT', description: 'إيجار المحل', amount: '0.1', paymentMethod: 'CASH', expenseDate: '2026-09-06', notes: 'اختبار المصاريف', ...extra });
  const create = (body: Record<string, unknown>) => request(app.getHttpServer()).post('/expenses').send(body);
  const idFrom = (value: unknown): number => { if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'number') throw new Error('Missing ID'); return value.id; };
  const balance = async () => { const body = (await request(app.getHttpServer()).get('/cash/summary').expect(200)).body as { physicalCashBalance: string }; return body.physicalCashBalance.startsWith('-') ? -moneyUnits(body.physicalCashBalance.slice(1)) : moneyUnits(body.physicalCashBalance); };
  const linked = (id: number) => db.orm.public.CashMovement.where({ sourceType: 'EXPENSE', sourceId: id }).all();
  beforeAll(async () => {
    originalStock = await db.orm.public.StockMovement.orderBy((row) => row.id.asc()).all();
    Reflect.defineMetadata('design:paramtypes', [ExpensesService], ExpensesController);
    Reflect.defineMetadata('design:paramtypes', [CashService], CashController);
    const module = await Test.createTestingModule({ controllers: [ExpensesController, CashController], providers: [ExpensesService, CashService] }).compile();
    app = module.createNestApplication({ logger: false }); await app.init();
  });
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('BEGIN');
      const ids = (await client.query<{ id: number }>('SELECT id FROM public.expense WHERE reference LIKE $1', [`${token}-%`])).rows.map((row) => row.id);
      await client.query('DELETE FROM public."cashMovement" WHERE "expenseId" = ANY($1::int[])', [ids]);
      await client.query('DELETE FROM public.expense WHERE id = ANY($1::int[])', [ids]);
      await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public.expense WHERE reference LIKE $1', [`${token}-%`])).rowCount).toBe(0);
      expect((await client.query('SELECT id FROM public."cashMovement" WHERE "expenseId" = ANY($1::int[])', [ids])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); await db.close(); }
  });
  it.each(['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER'])('creates exactly one linked OUT movement with correct %s cash impact', async (paymentMethod) => {
    const before = await balance(), input = data({ paymentMethod }), response = await create(input).expect(201), id = idFrom(response.body);
    const rows = await linked(id); expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'OUT', sourceType: 'EXPENSE', expenseId: id, sourceId: id, amount: '0.100', paymentMethod, movementDate: input.expenseDate, reference: input.reference, description: input.description, notes: input.notes });
    expect(await balance() - before).toBe(paymentMethod === 'CASH' ? -moneyUnits('0.1') : 0n);
    expect((await request(app.getHttpServer()).get(`/expenses/${id}`).expect(200)).body).toEqual(response.body);
    expect((await request(app.getHttpServer()).get(`/cash/movements/${rows[0].id}`).expect(200)).body).toMatchObject({ linkedExpenseId: id, linkedReference: input.reference });
  });
  it('rejects invalid input and concurrent duplicate references without extra movements', async () => {
    const input = data();
    for (const override of [{ amount: '0' }, { amount: '-1' }, { category: 'INVALID' }, { paymentMethod: 'INVALID' }, { expenseDate: '2026-02-30' }, { reference: '' }, { description: ' ' }]) await create({ ...input, ...override }).expect(400);
    const responses = await Promise.all([create(input), create(input)]);
    expect(responses.map((row) => row.status).sort()).toEqual([201, 409]);
    expect(responses.find((row) => row.status === 409)?.body).toMatchObject({ message: 'Cette référence de dépense existe déjà.' });
    const expense = await db.orm.public.Expense.first({ reference: input.reference }); expect(expense).not.toBeNull();
    expect(await linked(expense!.id)).toHaveLength(1);
  });
  it('preserves exact large decimal amounts and rejects a duplicate source link at the database', async () => {
    const amount = '9007199254740993.123456789012345678901234567890123456';
    const response = await create(data({ amount, paymentMethod: 'CARD' })).expect(201), id = idFrom(response.body), rows = await linked(id);
    expect(response.body).toMatchObject({ amount }); expect(rows[0].amount).toBe(amount);
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await expect(client.query('INSERT INTO public."cashMovement" (type,"sourceType","sourceId","expenseId",amount,"paymentMethod","movementDate",reference,description) SELECT type,"sourceType","sourceId","expenseId",amount,"paymentMethod","movementDate",reference,description FROM public."cashMovement" WHERE id=$1', [rows[0].id])).rejects.toMatchObject({ code: '23505' }); }
    finally { await client.end(); }
  });
  it('rolls back expense and cash movement if creation fails after cash insertion', async () => {
    const input = data(), before = await balance(), original = expenseCash.syncExpenseCash;
    const spy = vi.spyOn(expenseCash, 'syncExpenseCash').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('Injected cash failure'); });
    try { await create(input).expect(500); } finally { spy.mockRestore(); }
    expect(await db.orm.public.Expense.first({ reference: input.reference })).toBeNull();
    expect(await db.orm.public.CashMovement.where({ reference: input.reference }).all()).toEqual([]); expect(await balance()).toBe(before);
  });
  it('edits every field and adjusts CASH/non-CASH impact while keeping the same movement ID', async () => {
    const before = await balance(), response = await create(data()).expect(201), id = idFrom(response.body), original = (await linked(id))[0];
    const patch = { reference: `${token}-EDIT`, category: 'TRANSPORT', description: 'نقل البضائع', amount: '0.2', paymentMethod: 'BANK_TRANSFER', expenseDate: '2026-09-05', notes: null };
    const updated = await request(app.getHttpServer()).patch(`/expenses/${id}`).send(patch).expect(200);
    expect(updated.body).toMatchObject({ ...patch, amount: '0.200', id });
    const rows = await linked(id); expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ id: original.id, createdAt: original.createdAt, amount: '0.200', paymentMethod: 'BANK_TRANSFER', movementDate: patch.expenseDate, reference: patch.reference, description: patch.description, notes: null });
    expect(await balance()).toBe(before);
    await request(app.getHttpServer()).patch(`/expenses/${id}`).send({ paymentMethod: 'CASH', amount: '0.3' }).expect(200);
    expect(await balance() - before).toBe(-moneyUnits('0.3')); expect(await linked(id)).toHaveLength(1);
  });
  it('rolls back both edited records on cash failure and conflicting reference', async () => {
    const response = await create(data()).expect(201), id = idFrom(response.body), originalExpense = await db.orm.public.Expense.first({ id }), originalRows = await linked(id);
    const original = expenseCash.syncExpenseCash;
    const spy = vi.spyOn(expenseCash, 'syncExpenseCash').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('Injected edit failure'); });
    try { await request(app.getHttpServer()).patch(`/expenses/${id}`).send({ amount: '9', description: 'Changed' }).expect(500); } finally { spy.mockRestore(); }
    expect(await db.orm.public.Expense.first({ id })).toEqual(originalExpense); expect(await linked(id)).toEqual(originalRows);
    const other = data(); await create(other).expect(201);
    await request(app.getHttpServer()).patch(`/expenses/${id}`).send({ reference: other.reference, amount: '9' }).expect(409);
    expect(await db.orm.public.Expense.first({ id })).toEqual(originalExpense); expect(await linked(id)).toEqual(originalRows);
  });
  it('serializes partial edits, returns filtered-source history and leaves all stock unchanged', async () => {
    const response = await create(data()).expect(201), id = idFrom(response.body);
    const results = await Promise.all([request(app.getHttpServer()).patch(`/expenses/${id}`).send({ amount: '0.2' }), request(app.getHttpServer()).patch(`/expenses/${id}`).send({ description: 'Concurrent description' })]);
    expect(results.map((row) => row.status)).toEqual([200, 200]);
    expect(await db.orm.public.Expense.first({ id })).toMatchObject({ amount: '0.200', description: 'Concurrent description' });
    expect(await linked(id)).toHaveLength(1); expect((await linked(id))[0]).toMatchObject({ amount: '0.200', description: 'Concurrent description' });
    const list = (await request(app.getHttpServer()).get('/expenses').expect(200)).body as Array<{ id: number }>;
    expect(list.map((row) => row.id)).toEqual((await db.orm.public.Expense.orderBy([(row) => row.expenseDate.desc(), (row) => row.id.desc()]).all()).map((row) => row.id));
    expect((await request(app.getHttpServer()).get('/cash/movements').expect(200)).body).toEqual(expect.arrayContaining([expect.objectContaining({ sourceType: 'EXPENSE', linkedExpenseId: id })]));
    await request(app.getHttpServer()).get('/expenses/2147483647').expect(404);
    await request(app.getHttpServer()).patch('/expenses/2147483647').send({ amount: '1' }).expect(404);
    await request(app.getHttpServer()).delete(`/expenses/${id}`).expect(404);
    expect(await db.orm.public.StockMovement.orderBy((row) => row.id.asc()).all()).toEqual(originalStock);
  });
});
