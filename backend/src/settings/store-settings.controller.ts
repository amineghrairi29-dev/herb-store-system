import { Body, Controller, Get, Header, Inject, Patch } from '@nestjs/common';
import { Access } from '../auth/auth-policy.js';
import { StoreSettingsService } from './store-settings.service.js';
import { reportIdentity } from './store-settings.values.js';
@Access('SYSTEM')
@Controller('settings/store')
export class StoreSettingsController {
  constructor(@Inject(StoreSettingsService) private readonly settings: StoreSettingsService) {}
  @Get() read() { return this.settings.read(); }
  @Patch() update(@Body() body: unknown) { return this.settings.update(body); }
}
@Controller()
export class StoreIdentityController {
  constructor(@Inject(StoreSettingsService) private readonly settings: StoreSettingsService) {}
  @Access('PUBLIC') @Get('public/store-info') @Header('Cache-Control', 'no-store')
  async publicInfo() { const row = await this.settings.read(); return { storeName: row.storeName }; }
  @Access('REPORTS') @Get('reports/store-info/identity')
  async reportInfo() { return reportIdentity(await this.settings.read()); }
}
