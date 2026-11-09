import { Body, Controller, Get, Inject, Module, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Access } from '../auth/auth-policy.js';
import { CategoriesService } from './categories.service.js';
@Access('CATEGORIES')
@Controller('categories')
class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly service: CategoriesService) {}
  @Get() list() { return this.service.list(); }
  @Post() create(@Body() body: unknown) { return this.service.create(body); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.service.detail(id); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.service.update(id, body); }
  @Get(':id/subcategories') subs(@Param('id', ParseIntPipe) id: number) { return this.service.subcategories(id); }
  @Post(':id/subcategories') createSub(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.service.createSubcategory(id, body); }
}
@Access('CATEGORIES')
@Controller('subcategories')
class SubcategoriesController {
  constructor(@Inject(CategoriesService) private readonly service: CategoriesService) {}
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.service.updateSubcategory(id, body); }
}
@Module({ controllers: [CategoriesController, SubcategoriesController], providers: [CategoriesService] })
export class CategoriesModule {}
