"use client";
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/auth';
export default function StoreName() {
  const [name, setName] = useState('Herb Store');
  useEffect(() => {
    let active = true, version = 0;
    const reload = async () => {
      const request = ++version;
      try {
        const response = await fetch(`${authApi}/public/store-info`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        const value: unknown = await response.json();
        if (!response.ok || !value || typeof value !== 'object' || !('storeName' in value) || typeof value.storeName !== 'string' || !value.storeName.trim()) throw new Error();
        if (active && request === version) setName(value.storeName);
      } catch { if (active && request === version) setName('Herb Store'); }
    };
    void reload(); window.addEventListener('store:updated', reload);
    return () => { active = false; window.removeEventListener('store:updated', reload); };
  }, []);
  return <bdi data-store-name className="break-words">{name}</bdi>;
}
