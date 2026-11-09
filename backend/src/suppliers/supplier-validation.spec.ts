import { isUniqueViolation, supplierId, validateSupplier } from './supplier-validation.js';

describe('Supplier input validation', () => {
  it('trims UTF-8 text and normalizes empty optional fields', () => {
    expect(validateSupplier({ code: ' SUP-1 ', name: ' مورد ', email: ' ', notes: null }, false)).toEqual({ code: 'SUP-1', name: 'مورد', email: null, notes: null });
    expect(validateSupplier({ isActive: false }, true)).toEqual({ isActive: false });
  });
  it.each([null, [], {}, { code: ' ', name: 'Atlas' }, { code: 'A', name: '' }, { code: 'A', name: 'Atlas', email: 'bad' }, { code: 'A', name: 'Atlas', phone: 123 }, { code: 'A', name: 'Atlas', isActive: 'true' }, { code: 'A', name: 'Atlas', id: 1 }])('rejects invalid create input %j', (input) => {
    expect(() => validateSupplier(input, false)).toThrow();
  });
  it('validates identifiers and recognizes nested unique constraint errors', () => {
    for (const id of [0, -1, 1.2, 2147483648, NaN]) expect(() => supplierId(id)).toThrow();
    expect(supplierId(1)).toBe(1);
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
    expect(isUniqueViolation(new Error('network'))).toBe(false);
  });
});
