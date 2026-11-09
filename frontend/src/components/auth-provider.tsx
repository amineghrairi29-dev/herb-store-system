"use client";
import Link from 'next/link';
import AdminShell from './admin-shell';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi, authRequest, canOpen, publicPage, readCurrentUser, type CurrentUser } from '@/lib/auth';
type AuthState = { user: CurrentUser | null; loading: boolean; reload: () => Promise<void>; logout: () => Promise<void> };
const Context = createContext<AuthState | null>(null);
export function useAuth() { const state = useContext(Context); if (!state) throw new Error('AuthProvider required'); return state; }
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname(), router = useRouter(), isPublic = publicPage(pathname);
  const sessionCheck = useRef(0);
  const reload = useCallback(async () => {
    const check = ++sessionCheck.current;
    try {
      const response = await fetch(`${authApi}/auth/me`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (check !== sessionCheck.current) return;
      if (response.status === 401) setUser(null);
      else { if (!response.ok) throw new Error('Impossible de vérifier la session.'); const current = readCurrentUser(await response.json()); if (check !== sessionCheck.current) return; setUser(current); }
      setError('');
    } catch { if (check === sessionCheck.current) setError('Connexion au serveur impossible. Réessayez.'); }
    finally { if (check === sessionCheck.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(reload);
    const expired = () => { sessionCheck.current++; setUser(null); setLoading(false); setError(''); };
    const focus = () => { void reload(); };
    window.addEventListener('auth:expired', expired); window.addEventListener('focus', focus); window.addEventListener('pageshow', focus);
    const timer = setInterval(focus, 60000);
    return () => { window.removeEventListener('auth:expired', expired); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); clearInterval(timer); };
  }, [reload]);
  useEffect(() => { if (!isPublic && !loading && !user && !error) router.replace('/auth'); }, [isPublic, loading, user, error, router]);
  async function logout() {
    setLoggingOut(true);
    try { await authRequest('/auth/logout', { method: 'POST' }); sessionCheck.current++; setUser(null); router.replace('/auth'); router.refresh(); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Déconnexion impossible.'); }
    finally { setLoggingOut(false); }
  }
  const state = { user, loading, reload, logout };
  if (isPublic) return <Context.Provider value={state}>{children}</Context.Provider>;
  if (error) return <Context.Provider value={state}><main className="p-8"><p role="alert">{error}</p><button className="mt-4 underline" onClick={() => void reload()}>Réessayer</button></main></Context.Provider>;
  if (loading || !user) return <main className="p-8" role="status">Chargement de la session...</main>;
  return <Context.Provider value={state}><AdminShell key={pathname} user={user} busy={loggingOut} logout={logout}>{canOpen(user.role, pathname) ? children : <main className="p-8"><h1 className="text-2xl font-semibold">Accès non autorisé</h1><p className="mt-3">Votre rôle ne permet pas d’accéder à cette page.</p><Link href="/products" className="mt-5 inline-block text-emerald-800 underline">Retour aux produits</Link></main>}</AdminShell></Context.Provider>;
}
