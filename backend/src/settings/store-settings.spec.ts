import { settingsInput, defaultSettings, reportIdentity } from './store-settings.values.js';
describe('Store display settings validation', () => {
  it('provides neutral defaults and normalizes optional fields', () => {
    expect(defaultSettings.storeName).toBe('Herb Store'); expect(defaultSettings.currency).toBe('TND');
    expect(settingsInput({ storeName: ' أعشاب تونس ', phone: ' ', email: null })).toEqual({ storeName: 'أعشاب تونس', phone: null, email: null });
  });
  it.each([null, [], {}, { storeName: '' }, { storeName: '   ' }, { storeName: null }, { storeName: 'x'.repeat(161) }, { email: 'invalid' }, { email: 'a@b' }, { currency: 'EUR' }, { currency: null }, { phone: 123 }, { reportFooter: 'x'.repeat(1001) }, { id: 2 }, { password: 'secret' }, { website: 'javascript:alert(1)' }, { website: 'https://user:secret@example.com' }, { city: '\0' }])('rejects invalid settings: %j', body => {
    expect(() => settingsInput(body)).toThrow();
  });
  it('accepts partial updates, valid email and HTTP URLs only', () => {
    expect(settingsInput({ email: 'contact@example.com', website: 'https://example.com', currency: 'TND' })).toEqual({ email: 'contact@example.com', website: 'https://example.com', currency: 'TND' });
  });
  it('limits report identity to display fields', () => {
    expect(Object.keys(reportIdentity(defaultSettings)).sort()).toEqual(['address', 'city', 'email', 'phone', 'reportFooter', 'storeName']);
  });
});
