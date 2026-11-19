import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Module,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  type ProductImageUpload,
} from '../products/product-image-storage.js';
import { Access } from '../auth/auth-policy.js';
import { ClassificationsService } from './classifications.service.js';
@Access('CATEGORIES')
@Controller('classifications')
class ClassificationsController {
  constructor(
    @Inject(ClassificationsService)
    private readonly service: ClassificationsService,
  ) {}
  @Get() list() {
    return this.service.list();
  }
  @Post() create(@Body() body: unknown) {
    return this.service.create(body);
  }
  @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.service.update(id, body);
  }
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: MAX_PRODUCT_IMAGE_BYTES,
        files: 1,
        fields: 0,
        parts: 2,
      },
    }),
  )
  uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: ProductImageUpload,
  ) {
    return this.service.replaceImage(id, file);
  }
  @Delete(':id/image') removeImage(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeImage(id);
  }
}
@Module({
  controllers: [ClassificationsController],
  providers: [ClassificationsService],
})
export class ClassificationsModule {}
