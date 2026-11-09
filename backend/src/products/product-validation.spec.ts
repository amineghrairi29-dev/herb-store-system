import { BadRequestException } from '@nestjs/common';
import { compareDecimals, validateProductInput, validateStockRange } from './product-validation.js';

const valid = {
  sku: 'TEST', name: 'نعناع', productType: 'VRAC', salePrice: '12.500',
  classificationIds: [1], measurementMode: 'WEIGHT', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000.000',
};

describe('Product stock-reference validation', () => {
  it('preserves Arabic and decimal strings', () => {
    expect(validateProductInput(valid, false)).toEqual(valid);
  });

  it.each(['', ' \t\n ', null])('normalizes absent barcode %j consistently', barcode => {
    expect(validateProductInput({ ...valid, barcode }, false).barcode).toBeNull();
    expect(validateProductInput({ barcode }, true)).toEqual({ barcode: null });
  });
  it('trims real barcodes, preserves omitted updates and rejects non-text barcodes', () => {
    expect(validateProductInput({ barcode: ' 0123456789 ' }, true)).toEqual({ barcode: '0123456789' });
    expect(validateProductInput({ name: 'نعناع' }, true)).not.toHaveProperty('barcode');
    for (const barcode of [123, false, {}]) expect(() => validateProductInput({ barcode }, true)).toThrow(BadRequestException);
  });

  it.each([
    { classificationIds: [] }, { classificationIds: [0] }, { measurementMode: 'UNKNOWN' }, { storageUnit: 'BOX' }, { saleUnit: '' },
    { conversionFactor: '0.000' }, { conversionFactor: '-1' }, { conversionFactor: 1000 },
    { minStock: '-1' }, { minStock: 'NaN' }, { maxStock: 'Infinity' },
    { minStock: '10.000', maxStock: '9.999' }, { currentStock: '10' },
  ])('rejects invalid input %j', (change) => {
    expect(() => validateProductInput({ ...valid, ...change }, false)).toThrow(BadRequestException);
  });

  it('requires new fields on creation but permits partial updates', () => {
    expect(() => validateProductInput({ sku: 'TEST' }, false)).toThrow(BadRequestException);
    expect(validateProductInput({ classificationIds: [2, 3, 2] }, true)).toEqual({ classificationIds: [2, 3] });
  });

  it('allows clearing optional thresholds and accepts zero', () => {
    expect(validateProductInput({ minStock: null, maxStock: '0.000' }, true)).toEqual({ minStock: null, maxStock: '0.000' });
  });

  it('compares decimals precisely beyond JavaScript number precision', () => {
    expect(compareDecimals('9007199254740993.001', '9007199254740993.002')).toBe(-1);
    expect(compareDecimals('0001.5', '1.500')).toBe(0);
    expect(() => validateStockRange('9007199254740993.002', '9007199254740993.001')).toThrow(BadRequestException);
  });
});
