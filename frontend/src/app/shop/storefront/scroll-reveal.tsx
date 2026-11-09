"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Visible without JS; observes once and never hides focused content. */
export default function ScrollReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reveal = () => { element.dataset.revealed = 'true'; observer.disconnect(); };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) reveal();
    }, { threshold: 0.1 });
    const onMotionChange = () => { if (motion.matches) reveal(); };
    if (motion.matches) reveal();
    else {
      element.dataset.revealed = 'false';
      observer.observe(element);
    }
    element.addEventListener('focusin', reveal);
    motion.addEventListener('change', onMotionChange);
    return () => { observer.disconnect(); element.removeEventListener('focusin', reveal); motion.removeEventListener('change', onMotionChange); };
  }, []);
  return <div ref={ref} className={`sf-scroll-reveal ${className ?? ''}`}>{children}</div>;
}
