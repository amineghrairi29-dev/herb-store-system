import { AsyncLocalStorage } from 'node:async_hooks';
import type { SafeUser } from '../auth/auth-policy.js';
export interface AuditContext { actor: SafeUser | null; ipAddress: string | null; userAgent: string | null }
export const auditContext = new AsyncLocalStorage<AuditContext>();
