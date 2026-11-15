import { compareMoney, deliveryFee, deliveryZoneInput, governorates, moneyText } from './delivery-values.js';
describe('Delivery values', () => {
  it('lists the 24 governorates', () => { expect(governorates).toHaveLength(24); expect(new Set(governorates).size).toBe(24); expect(governorates).toContain('Gabès'); });
  it('normalizes money to 3 decimals', () => { expect(moneyText('7', 'fee', 1000)).toBe('7.000'); expect(moneyText('7.5', 'fee', 1000)).toBe('7.500'); expect(moneyText(0, 'fee', 1000)).toBe('0.000'); });
  it.each(['-1', '7.1234', 'abc', '1000', ''])('rejects invalid amount %s', (value) => { expect(() => moneyText(value, 'fee', 1000)).toThrow(); });
  it('compares amounts', () => { expect(compareMoney('80.000', '80')).toBe(0); expect(compareMoney('79.999', '80.000')).toBe(-1); expect(compareMoney('100.5', '80')).toBe(1); });
  it('makes delivery free from the threshold', () => {
    const zone = { fee: '7.000', freeAbove: '80.000' };
    expect(deliveryFee(zone, '79.999')).toBe('7.000');
    expect(deliveryFee(zone, '80.000')).toBe('0.000');
    expect(deliveryFee({ fee: '7.000', freeAbove: null }, '500.000')).toBe('7.000');
  });
  it('validates a zone', () => {
    expect(deliveryZoneInput({ governorate: 'Gabès', fee: '7', freeAbove: '', delay: ' 24 à 48 h ', isActive: true })).toEqual({ governorate: 'Gabès', fee: '7.000', freeAbove: null, delay: '24 à 48 h', isActive: true });
    expect(() => deliveryZoneInput({ governorate: 'Paris', fee: '7', isActive: true })).toThrow();
    expect(() => deliveryZoneInput({ governorate: 'Gabès', fee: '7', isActive: 'yes' })).toThrow();
    expect(() => deliveryZoneInput({ governorate: 'Gabès', fee: '7', isActive: true, extra: 1 })).toThrow();
    expect(() => deliveryZoneInput({ governorate: 'Gabès', fee: '7', freeAbove: '0', isActive: true })).toThrow();
  });
});
