import { SetMetadata } from '@nestjs/common';
export const roles = ['ADMIN'] as const;
export type Role = typeof roles[number];
export type Permission = 'PUBLIC' | 'PUBLIC_AUTH' | 'AUTH' | 'SYSTEM' | 'USERS' | 'CATEGORIES' | 'PRODUCTS' | 'STOCK' | 'SUPPLIERS' | 'PURCHASES' | 'SALES' | 'CASH' | 'EXPENSES' | 'FINANCE' | 'REPORTS' | 'ONLINE_ORDERS';
export const ACCESS = 'backoffice:access';
export const Access = (permission: Permission) => SetMetadata(ACCESS, permission);
export function allowed(role: string, _permission: Permission, _method: string): boolean {
  return role === 'ADMIN';
}
export type SafeUser = { id: number; fullName: string; email: string; role: Role };
export function safeUser(user: { id: number; fullName: string; email: string; role: string }): SafeUser {
  if (!roles.includes(user.role as Role)) throw new Error('Invalid stored user role');
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role as Role };
}
