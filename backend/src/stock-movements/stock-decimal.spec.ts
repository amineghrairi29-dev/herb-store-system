import { aggregateStock, convertQuantity, decimalString, decimalUnits, movementTypes, positiveTypes } from './stock-decimal.js';
import { validateMovement } from './dto/create-stock-movement.dto.js';

const product = { storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' };

describe('Stock movement arithmetic and validation', () => {
  it('converts grams and accepts kilograms directly', () => {
    expect(convertQuantity('500', 'G', product)).toBe('0.500');
    expect(convertQuantity('2', 'KG', product)).toBe('2.000');
    expect(convertQuantity('3', 'PIECE', { storageUnit: 'PIECE', saleUnit: 'PIECE', conversionFactor: '1' })).toBe('3.000');
  });
  it('never rounds through floating-point numbers', () => {
    expect(convertQuantity('9007199254740993', 'G', product)).toBe('9007199254740.993');
    expect(decimalString(decimalUnits('0.1') + decimalUnits('0.2'))).toBe('0.300');
    expect(convertQuantity('0.000000000000001', 'G', product)).toBe('0.000000000000000001');
  });
  it('rejects incompatible units and ambiguous same-unit configuration', () => {
    expect(() => convertQuantity('1', 'L', product)).toThrow('incompatible');
    expect(() => convertQuantity('1', 'PIECE', { storageUnit: 'PIECE', saleUnit: 'PIECE', conversionFactor: '2' })).toThrow('identiques');
  });
  it('rejects inexact division rather than silently rounding inventory', () => {
    expect(() => convertQuantity('1', 'G', { ...product, conversionFactor: '3' })).toThrow('non exacte');
    expect(() => convertQuantity('0.000000000000000001', 'G', product)).toThrow('non exacte');
  });
  it('aggregates the requested example and zero history', () => {
    expect(decimalString(aggregateStock([
      { type: 'ENTRY', quantityInStorageUnit: '10' },
      { type: 'EXIT', quantityInStorageUnit: '0.5' },
      { type: 'LOSS', quantityInStorageUnit: '0.2' },
    ]))).toBe('9.300');
    expect(decimalString(aggregateStock([]))).toBe('0.000');
  });
  it.each(movementTypes)('uses the correct sign for %s', (type) => {
    expect(aggregateStock([{ type, quantityInStorageUnit: '1' }])).toBe(positiveTypes.includes(type) ? decimalUnits('1') : -decimalUnits('1'));
  });
  it.each(['0', '-1', 'NaN', 'Infinity', '1e3', '1,5', '0.0000000000000000001'])('rejects invalid quantity %s', (quantity) => {
    expect(() => validateMovement({ productId: 1, type: 'ENTRY', quantity, unit: 'G' })).toThrow();
  });
  it('rejects calculated fields from the client and unknown movement types', () => {
    const input = { productId: 1, type: 'ENTRY', quantity: '1', unit: 'G' };
    expect(() => validateMovement({ ...input, quantityInStorageUnit: '1000' })).toThrow('non autorisé');
    expect(() => validateMovement({ ...input, type: 'SALE' })).toThrow('invalide');
    expect(() => validateMovement({ ...input, quantity: 1 })).toThrow();
  });
});
