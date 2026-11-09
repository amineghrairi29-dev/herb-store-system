import { safeMetadata, changedFields } from './audit-values.js';
import { auditQuery } from './audit-query.js';
describe('Audit safety and query validation', () => {
  it('uses an allowlist and never copies secret values or nested payloads', () => {
    expect(safeMetadata({ password: 'secret', passwordHash: 'hash', token: 'token', cookie: 'cookie', headers: { authorization: 'secret' }, changedFields: ['password', 'passwordHash', 'role', 'name', 'unknown'], roleBefore: 'ADMIN', roleAfter: 'ADMIN', amount: '12.500', paymentMethod: 'CASH', arbitrary: 'secret' })).toEqual({ changedFields: ['name', 'role'], roleBefore: 'ADMIN', roleAfter: 'ADMIN', amount: '12.500', paymentMethod: 'CASH' });
    expect(safeMetadata({ roleBefore: 'token', amount: 'secret', productId: -1, activeBefore: 'secret', movementType: 'other' })).toEqual({});
    expect(changedFields({ password: 'secret', reportFooter: 'private', storeName: 'Store' })).toEqual(['reportFooter', 'storeName']);
  });
  it('caps pagination and accepts literal search and valid business dates', () => { expect(auditQuery({ pageSize: '1000', search: 'عشبة%', dateFrom: '2026-01-01', dateTo: '2026-12-31' })).toMatchObject({ pageSize: 100, page: 1, search: 'عشبة%' }); });
  it.each([{ dateFrom: '2026-02-30' }, { dateFrom: '2026-02-03', dateTo: '2026-01-01' }, { page: '0' }, { page: '-1' }, { actorUserId: 'x' }, { action: 'UNKNOWN' }, { entityType: 'SECRET' }, { outcome: 'other' }, { search: 'x'.repeat(201) }, { role: 'ADMIN' }, { action: ['SALE_CREATE'] }])('rejects invalid filters %j', query => { expect(() => auditQuery(query)).toThrow(); });
});
