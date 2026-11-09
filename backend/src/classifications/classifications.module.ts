import { Body, Controller, Get, Inject, Module, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Access } from '../auth/auth-policy.js';
import { ClassificationsService } from './classifications.service.js';
@Access('CATEGORIES')
@Controller('classifications')
class ClassificationsController {
  constructor(@Inject(ClassificationsService) private readonly service: ClassificationsService) {}
  @Get() list() { return this.service.list(); }
  @Post() create(@Body() body: unknown) { return this.service.create(body); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.service.update(id, body); }
}
@Module({ controllers: [ClassificationsController], providers: [ClassificationsService] })
export class ClassificationsModule {}
