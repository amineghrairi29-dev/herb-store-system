import { catalogueQuery } from './catalogue-query.js';

describe('Catalogue query validation', () => {
  it('defaults and caps page size', () => {
    expect(catalogueQuery({})).toMatchObject({ page: 1, pageSize: 24, sort: 'name_asc' });
    expect(catalogueQuery({ pageSize: '1000' }).pageSize).toBe(60);
    expect(catalogueQuery({ q: '  نعناع  ' }).q).toBe('نعناع');
  });
  it.each([{ page: '0' }, { page: '-1' }, { page: '1.5' }, { pageSize: '' }, { page: '99999999999999999999' }, { sort: '__proto__' }, { sort: 'name; DROP TABLE product' }, { availability: 'UNKNOWN' }, { q: ['one', 'two'] }, { q: 'x'.repeat(201) }, { internal: 'true' }])('rejects invalid query %j', (query) => {
    expect(() => catalogueQuery(query)).toThrow();
  });
});
