import { UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service.js';

const mocks = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('../purchases/purchase-transaction.js', () => ({
  withPurchaseTransaction: async (work: (tx: unknown) => Promise<unknown>) => work({
    client: { query: mocks.query },
    orm: { public: { AuthSession: { create: mocks.create }, User: { where: () => ({ update: mocks.update }) } } },
  }),
}));

describe('Internal authentication fails closed for unsupported actors', () => {
  let passwordHash: string;
  beforeAll(async () => { passwordHash = await hash('Temporary-Test9!', 4); });
  beforeEach(() => { vi.clearAllMocks(); });

  // Legacy values are adversarial inputs, never supported user fixtures.
  it.each(['MANAGER', 'SELLER', 'AGENT', 'CUSTOMER', 'UNKNOWN'])('rejects %s credentials and existing sessions', async role => {
    mocks.query.mockResolvedValue({ rows: [{ id: 1, email: 'test@example.test', fullName: 'Test', role, isActive: true, passwordHash }] });
    const auth = new AuthService();
    await expect(auth.login({ email: 'test@example.test', password: 'Temporary-Test9!' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.current('copied-legacy-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
