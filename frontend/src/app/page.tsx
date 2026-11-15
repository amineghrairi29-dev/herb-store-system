import { redirect } from 'next/navigation';
// The domain opens on the shop; the back office stays reachable through /auth.
export default function Home() { redirect('/shop'); }
