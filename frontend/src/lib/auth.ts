import { apiBase } from "@/lib/api-base";
export type Role = 'ADMIN';
export type CurrentUser = { id: number; fullName: string; email: string; role: Role };
export type ManagedUser = CurrentUser & { isActive: boolean; lastLoginAt: string | null };
export const roleLabels: Record<Role, string> = { ADMIN: 'Administrateur' };
export const authApi = apiBase;
export const publicPage = (path: string) => path === '/' || path === '/auth' || path === '/login' || path === '/shop' || path.startsWith('/shop/');
export function canOpen(role: Role, path: string) {
  const route = path.split(/[?#]/)[0];
  if (publicPage(route)) return true;
  return role === 'ADMIN';
}
export function readCurrentUser(value: unknown): CurrentUser {
  if (!value || typeof value !== 'object') throw new Error('Réponse utilisateur invalide.');
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'number' || typeof v.fullName !== 'string' || typeof v.email !== 'string' || !['ADMIN'].includes(String(v.role))) throw new Error('Réponse utilisateur invalide.');
  return { id: v.id, fullName: v.fullName, email: v.email, role: v.role as Role };
}
export async function authFetch(input: string, init?: RequestInit) {
  const response = await fetch(input.startsWith('/') ? `${apiBase}${input}` : input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20000), credentials: 'include', cache: 'no-store' });
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
  return response;
}
export async function authRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authFetch(`${authApi}${path}`, { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
    throw new Error(typeof message === 'string' ? message : 'Requête impossible. Réessayez.');
  }
  return body;
}

export function readManagedUser(value: unknown): ManagedUser {
  const user = readCurrentUser(value), row = value as Record<string, unknown>;
  if (typeof row.isActive !== 'boolean' || row.lastLoginAt !== null && typeof row.lastLoginAt !== 'string') throw new Error('Réponse utilisateur invalide.');
  return { ...user, isActive: row.isActive, lastLoginAt: row.lastLoginAt as string | null };
}
