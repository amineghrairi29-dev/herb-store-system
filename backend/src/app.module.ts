import { ClassificationsModule } from './classifications/classifications.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductImagesModule } from './products/product-images.module.js';
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { DatabaseLifecycle } from './prisma/database-lifecycle.js';
import { AuditModule } from './audit/audit.module.js';
import { StoreSettingsModule } from './settings/store-settings.module.js';
import { DeliveryZonesModule } from './delivery/delivery-zones.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductsModule } from './products/products.module.js';
import { StockMovementsModule } from './stock-movements/stock-movements.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { PurchasesModule } from './purchases/purchases.module.js';
import { SalesModule } from './sales/sales.module.js';
import { CashModule } from './cash/cash.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { PublicCatalogueModule } from './public-catalogue/public-catalogue.module.js';
import { OnlineOrdersModule } from './online-orders/online-orders.module.js';

@Module({
  imports: [ClassificationsModule, ProductImagesModule, CategoriesModule, AuthModule, AuditModule, StoreSettingsModule, DeliveryZonesModule, DashboardModule, ProductsModule, StockMovementsModule, SuppliersModule, PurchasesModule, SalesModule, CashModule, ExpensesModule, FinanceModule, ReportsModule, PublicCatalogueModule, OnlineOrdersModule],
  controllers: [AppController, HealthController],
  providers: [AppService, DatabaseLifecycle],
})
export class AppModule {}
