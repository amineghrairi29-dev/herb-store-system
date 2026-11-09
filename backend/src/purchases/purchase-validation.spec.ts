import { lineTotal, totalAmount, validatePurchase } from './purchase-validation.js';
const input = { reference: ' PUR-1 ', supplierId: 1, purchaseDate: '2026-09-06', lines: [{ productId: 1, quantity: '500', unit: 'G', unitPurchasePrice: '0.020' }] };
describe('Purchase validation and exact money arithmetic', () => {
  it('normalizes inputs and calculates selected-unit totals exactly', () => {
    expect(validatePurchase(input, false)).toMatchObject({ reference: 'PUR-1', lines: [{ quantity: '500.000', unitPurchasePrice: '0.020' }] });
    expect(lineTotal('500', '0.020')).toBe('10.000');
    expect(lineTotal('2', '18')).toBe('36.000');
    expect(totalAmount([{ lineTotal: '10.000' }, { lineTotal: '36.000' }])).toBe('46.000');
    expect(lineTotal('0.000000000000000001', '0.000000000000000001')).toBe(`0.${'0'.repeat(35)}1`);
    expect(lineTotal('9007199254740993', '0.1')).toBe('900719925474099.300');
    expect(totalAmount([{ lineTotal: '0.1' }, { lineTotal: '0.2' }])).toBe('0.300');
  });
  it.each(['0', '-1', '1e3', 'NaN', 'Infinity', '1,2', '0.0000000000000000001', 2, null])('rejects invalid quantity/price %j', (value) => {
    for (const field of ['quantity', 'unitPurchasePrice']) expect(() => validatePurchase({ ...input, lines: [{ ...input.lines[0], [field]: value }] }, false)).toThrow();
  });
  it('rejects missing fields, invalid dates, duplicate products, and client totals', () => {
    for (const body of [{}, { ...input, reference: ' ' }, { ...input, supplierId: 0 }, { ...input, purchaseDate: '2026-02-30' }, { ...input, lines: [] }, { ...input, lines: [...input.lines, ...input.lines] }, { ...input, totalAmount: '0' }, { ...input, lines: [{ ...input.lines[0], quantityInStorageUnit: '900' }] }]) expect(() => validatePurchase(body, false)).toThrow();
    expect(validatePurchase({ notes: null }, true)).toEqual({ notes: null });
    expect(() => validatePurchase({ status: 'CONFIRMED' }, true)).toThrow();
  });
});
