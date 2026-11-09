"use client";
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { canOpen } from '@/lib/auth';
import { useAuth } from './auth-provider';
export default function AuthLink(props: ComponentProps<typeof Link>) {
  const { user } = useAuth(); const path = typeof props.href === 'string' ? props.href : props.href.pathname;
  if (user && path && path.startsWith('/') && !canOpen(user.role, path)) return null;
  return <Link {...props} />;
}
export function CanManageInventory({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); return user && user.role === 'ADMIN' ? children : null;
}
