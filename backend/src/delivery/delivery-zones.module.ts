import { Body, Controller, Get, Header, Inject, Module, Put } from '@nestjs/common';
import { Access } from '../auth/auth-policy.js';
import { DeliveryZonesService } from './delivery-zones.service.js';

@Access('SYSTEM')
@Controller('settings/delivery-zones')
class DeliveryZonesController {
  constructor(@Inject(DeliveryZonesService) private readonly zones: DeliveryZonesService) {}
  @Get() list() { return this.zones.list(); }
  @Put() update(@Body() body: unknown) { return this.zones.update(body); }
}

@Controller('public/delivery-zones')
class PublicDeliveryZonesController {
  constructor(@Inject(DeliveryZonesService) private readonly zones: DeliveryZonesService) {}
  @Access('PUBLIC') @Get() @Header('Cache-Control', 'no-store') list() { return this.zones.publicList(); }
}

@Module({ controllers: [DeliveryZonesController, PublicDeliveryZonesController], providers: [DeliveryZonesService], exports: [DeliveryZonesService] })
export class DeliveryZonesModule {}
