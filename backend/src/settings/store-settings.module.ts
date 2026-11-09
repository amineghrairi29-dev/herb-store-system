import { Module } from '@nestjs/common';
import { StoreSettingsController, StoreIdentityController } from './store-settings.controller.js';
import { StoreSettingsService } from './store-settings.service.js';
@Module({ controllers: [StoreSettingsController, StoreIdentityController], providers: [StoreSettingsService], exports: [StoreSettingsService] })
export class StoreSettingsModule {}
