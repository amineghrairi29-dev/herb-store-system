import { Module } from '@nestjs/common';
import { PublicCatalogueController } from './public-catalogue.controller.js';
import { PublicCatalogueService } from './public-catalogue.service.js';
import { PublicCartController } from './public-cart.controller.js';
import { PublicCartService } from './public-cart.service.js';

@Module({ controllers: [PublicCatalogueController, PublicCartController], providers: [PublicCatalogueService, PublicCartService] })
export class PublicCatalogueModule {}
