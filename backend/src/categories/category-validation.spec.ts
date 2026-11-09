import { allowedUnits, categoryInput } from './category-validation.js';
import { allowed } from '../auth/auth-policy.js';
describe('Category validation and permissions', () => {
  it.each([
    ['WEIGHT', ['G', 'KG']], ['VOLUME', ['ML', 'L']],
    ['WEIGHT_AND_VOLUME', ['G', 'KG', 'ML', 'L']], ['FLEXIBLE', ['G', 'KG', 'ML', 'L', 'PIECE']],
  ])('authoritative %s units', (mode, units) => expect(allowedUnits(String(mode))).toEqual(units));
  it('preserves Arabic and rejects uncontrolled fields/modes', () => {
    expect(categoryInput({ nameAr: ' أعشاب ', nameFr: 'Herbes', slug: 'herbes', measurementMode: 'WEIGHT' }, false).nameAr).toBe('أعشاب');
    for (const value of [{ measurementMode: 'UNKNOWN' }, { slug: 'Bad Slug' }, { sortOrder: 0.5 }, { sortOrder: -1 }, { isInternal: true }, { nameAr: '' }, { isActive: 'true' }]) expect(() => categoryInput(value, true)).toThrow();
    expect(() => categoryInput({ categoryId: 1 }, true, true)).toThrow();
  });
  it('allows only ADMIN category access', () => {
    for (const method of ['GET', 'POST', 'PATCH']) {
      expect(allowed('ADMIN', 'CATEGORIES', method)).toBe(true);
      expect(allowed('CUSTOMER', 'CATEGORIES', method)).toBe(false);
      expect(allowed('UNKNOWN', 'CATEGORIES', method)).toBe(false);
    }
  });
});
