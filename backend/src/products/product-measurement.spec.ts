import { validateMeasurement } from './product-measurement.js';
import { classificationIds } from '../classifications/classifications.service.js';
describe('Independent product measurement and classification validation', () => {
  it('requires a nonempty bounded set of numeric classifications', () => {
    for (const value of [undefined, null, [], [0], [-1], ['1'], [1.5], [2147483648], Array(101).fill(1)]) expect(() => classificationIds(value)).toThrow();
    expect(classificationIds([3, 1, 3])).toEqual([1, 3]);
  });
  it('keeps unit families on the product independently of any classification', () => {
    expect(() => validateMeasurement('WEIGHT', 'KG', 'G')).not.toThrow();
    expect(() => validateMeasurement('VOLUME', 'L', 'ML')).not.toThrow();
    expect(() => validateMeasurement('FLEXIBLE', 'PIECE', 'PIECE')).not.toThrow();
    expect(() => validateMeasurement('WEIGHT_AND_VOLUME', 'KG', 'ML')).not.toThrow();
    expect(() => validateMeasurement('WEIGHT', 'KG', 'ML')).toThrow();
    expect(() => validateMeasurement('VOLUME', 'PIECE', 'ML')).toThrow();
  });
});
