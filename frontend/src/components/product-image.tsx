'use client';
import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { productImageUrl } from '@/lib/product-image';

export default function ProductImage({ imagePath, name, className, fallback, sizes = '(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 25vw' }: {
  imagePath: string | null | undefined; name: string; className: string; fallback: ReactNode; sizes?: string;
}) {
  const src = productImageUrl(imagePath);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return fallback;
  return <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
    <Image src={src} alt={name} fill sizes={sizes} unoptimized className="object-contain" onError={() => setFailed(src)} />
  </div>;
}
