import { notifyNewOrder, orderNoticeText, type OrderNotice } from './order-notifier.js';
const order: OrderNotice = { reference: 'ORD-000042', totalAmount: '25.500', customerName: 'Amine', customerPhone: '98123456', deliveryAddress: 'Ghannouch', notes: null, items: [{ productNameSnapshot: 'Menthe', quantity: '0.250', unitSnapshot: 'KG' }] };
describe('Order notifier', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('formats the shop message with contact and lines', () => {
    const text = orderNoticeText(order);
    expect(text).toContain('ORD-000042');
    expect(text).toContain('98123456');
    expect(text).toContain('Menthe — 0.250 KG');
    expect(text).not.toContain('Note');
  });
  it('does nothing without Telegram settings', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', ''); vi.stubEnv('TELEGRAM_CHAT_ID', '');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await notifyNewOrder(order);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('never throws when Telegram is unreachable', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token'); vi.stubEnv('TELEGRAM_CHAT_ID', '1');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(notifyNewOrder(order)).resolves.toBeUndefined();
  });
});
