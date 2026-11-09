import type { INestApplication } from '@nestjs/common';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Express, Request, Response, NextFunction } from 'express';
import { frontendOrigin, sessionMilliseconds } from './auth-config.js';
import { proxyTrust, validateEnvironment } from './environment.js';
import { SafeExceptionFilter } from './safe-exception.filter.js';
import { InputBoundsPipe } from './input-bounds.pipe.js';
export function configureHttpSecurity(app: INestApplication) {
  validateEnvironment();
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', proxyTrust());
  sessionMilliseconds();
  app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'no-referrer' }, frameguard: { action: 'deny' }, strictTransportSecurity: process.env.NODE_ENV === 'production' ? { maxAge: 31536000 } : false }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin && req.headers.origin !== frontendOrigin()) {
      res.setHeader('Vary', 'Origin');
      res.status(403).json({ statusCode: 403, message: 'Origine de la requête non autorisée.' });
      return;
    }
    next();
  });
  app.useGlobalFilters(new SafeExceptionFilter());
  app.use(['/public/auth/register', '/public/auth/login', '/public/auth/google/start', '/public/auth/google/callback'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Trop de tentatives. Réessayez dans 15 minutes.' } }));
  app.use(['/auth/account/email', '/auth/account/password', '/public/auth/email', '/public/auth/password'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Trop de tentatives. R?essayez dans 15 minutes.' } }));
  app.useGlobalPipes(new InputBoundsPipe());
  app.enableCors({ origin: frontendOrigin(), methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true });
  app.use(['/auth/login', '/public/auth/sign-in'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Trop de tentatives. Réessayez dans 15 minutes.' } }));
}
