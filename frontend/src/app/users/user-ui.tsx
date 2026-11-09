import Link from '@/components/auth-link';
export const fieldClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
export const buttonClass = 'rounded-lg bg-emerald-800 px-5 py-3 font-semibold text-white disabled:opacity-50';
export function UserShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-6xl"><Link href="/users" className="text-sm text-emerald-800 underline">Utilisateurs</Link><h1 className="mb-8 mt-4 text-3xl font-semibold">{title}</h1>{children}</div></main>;
}
