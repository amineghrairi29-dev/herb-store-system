export interface Activity {
  id: number; type: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT' | 'ONLINE_ORDER';
  occurredAt: string; reference: string; description: string; amount: string; href: string; status: string | null;
}
export interface StockAttention { id: number; name: string; category: string; status: 'OUT_OF_STOCK' | 'LOW_STOCK'; stock: string; unit: string }
export interface PendingOrder { id: number; reference: string; customerName: string; createdAt: string; totalAmount: string }
export interface DashboardCommon {
  businessDate: string; timeZone: string;
  alerts: { pendingOnlineOrders: number; outOfStockProducts: number; lowStockProducts: number };
  recentActivity: Activity[]; stockAttention: StockAttention[]; pendingOrders: PendingOrder[];
}
export interface FullDashboard extends DashboardCommon {
  today: { sales: string; customerCollections: string; purchases: string; expenses: string };
  balances: { physicalCash: string; customerReceivables: string; supplierPayables: string };
}
