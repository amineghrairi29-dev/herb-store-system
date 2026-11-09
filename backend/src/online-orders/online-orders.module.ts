import { Module } from '@nestjs/common';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module.js';
import { OnlineOrdersService } from './online-orders.service.js';
import { OnlineOrdersController, PublicOrdersController } from './online-orders.controller.js';
import { SalesModule } from '../sales/sales.module.js';
import { OrderFulfillmentController } from './order-fulfillment.controller.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
@Module({ imports: [SalesModule, CustomerAuthModule], controllers: [OnlineOrdersController, PublicOrdersController, OrderFulfillmentController], providers: [OnlineOrdersService, OrderFulfillmentService] })
export class OnlineOrdersModule {}
