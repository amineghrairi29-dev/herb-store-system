import { redirect } from 'next/navigation';
// /admin opens the dashboard.
export default function AdminHome() { redirect('/admin/dashboard'); }
