import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthRequest } from '../auth/auth.guard.js';
import { auditContext } from './audit-context.js';
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    return new Observable(subscriber => auditContext.run({ actor: request.user ?? null, ipAddress: request.socket.remoteAddress ?? null, userAgent: request.get('user-agent')?.slice(0, 512) ?? null }, () => {
      const subscription = next.handle().subscribe(subscriber); return () => subscription.unsubscribe();
    }));
  }
}
