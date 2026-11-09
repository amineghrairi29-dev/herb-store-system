import { businessDate } from '../cash/cash-values.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import type { AuthRequest } from '../auth/auth.guard.js';
describe('Dashboard date and role boundary', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
  it('uses business local date on both sides of UTC midnight', () => {
    vi.stubEnv('CASH_TIME_ZONE', 'Africa/Tunis'); vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T22:59:59Z')); expect(businessDate().today).toBe('2026-09-07');
    vi.setSystemTime(new Date('2026-09-07T23:00:00Z')); expect(businessDate()).toEqual({ today: '2026-09-08', timeZone: 'Africa/Tunis' });
    vi.stubEnv('CASH_TIME_ZONE', 'America/New_York'); vi.setSystemTime(new Date('2026-09-08T01:00:00Z')); expect(businessDate().today).toBe('2026-09-07');
  });
  it('rejects all client role/date filters before calling the service', () => {
    const service = new DashboardService(), spy = vi.spyOn(service, 'summary');
    const controller = new DashboardController(service), request = { user: { role: 'ADMIN' } } as AuthRequest;
    for (const query of [{ role: 'ADMIN' }, { date: '2040-01-01' }, { period: 'year' }]) expect(() => controller.summary(request, query)).toThrow('sans filtre');
    expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
  });
});
