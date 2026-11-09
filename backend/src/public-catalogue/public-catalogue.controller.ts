import { Access } from '../auth/auth-policy.js';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicCatalogueService } from './public-catalogue.service.js';

@Access('PUBLIC')
@Controller('public')
export class PublicCatalogueController {
  constructor(private readonly catalogue: PublicCatalogueService) {}
  @Get('products') list(@Query() query: Record<string, unknown>) { return this.catalogue.list(query); }
  @Get('products/:id') detail(@Param('id') id: string) { return this.catalogue.detail(id); }
  @Get('classifications') classifications(@Query('withProducts') withProducts?: string) { return this.catalogue.categories(withProducts === 'true'); }
  @Get('categories') categories() { return this.catalogue.categories(); }
}
