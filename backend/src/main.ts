import './auth/startup.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureHttpSecurity } from './auth/http-security.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttpSecurity(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001, process.env.HOST || '127.0.0.1');
}
await bootstrap();
