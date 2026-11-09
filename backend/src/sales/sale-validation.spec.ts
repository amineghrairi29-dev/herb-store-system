import { validateSale } from './sale-validation.js';
import { lineTotal, totalAmount } from '../purchases/purchase-validation.js';
const input = { reference: ' SAL-1 ', saleDate: '2026-09-06', lines: [{ productId: 1, quantity: '500', unit: 'G', unitSalePrice: '0.030' }] };
describe('Sale validation and exact totals', () => {
  it('supports walk-in sales, Arabic text and exact selected-unit prices', () => {
    expect(validateSale(input, false)).toMatchObject({ reference: 'SAL-1', lines: [{ quantity: '500.000', unitSalePrice: '0.030' }] });
    expect(validateSale({ ...input, customerName: ' عميل ', customerPhone: '', notes: null }, false)).toMatchObject({ customerName: 'عميل', customerPhone: null, notes: null });
    expect(lineTotal('500', '0.030')).toBe('15.000');
    expect(totalAmount([{ lineTotal: '0.1' }, { lineTotal: '0.2' }])).toBe('0.300');
    expect(lineTotal('9007199254740993', '0.1')).toBe('900719925474099.300');
  });
  it.each(['0', '-1', 'NaN', 'Infinity', '1e3', '1,2', 1, null, '0.' + '0'.repeat(18) + '1'])('rejects invalid decimal %j', (value) => {
    for (const field of ['quantity', 'unitSalePrice']) expect(() => validateSale({ ...input, lines: [{ ...input.lines[0], [field]: value }] }, false)).toThrow();
  });
  it('rejects malformed bodies, invalid dates, duplicate lines and client-computed fields', () => {
    for (const body of [null, {}, { ...input, saleDate: '2026-02-30' }, { ...input, customerName: 123 }, { ...input, lines: [] }, { ...input, lines: [...input.lines, ...input.lines] }, { ...input, totalAmount: '1' }, { ...input, status: 'CONFIRMED' }, { ...input, lines: [{ ...input.lines[0], quantityInStorageUnit: '999' }] }]) expect(() => validateSale(body, false)).toThrow();
    expect(validateSale({ notes: null }, true)).toEqual({ notes: null });
  });
});
