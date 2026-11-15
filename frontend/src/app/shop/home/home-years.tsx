"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { shopContent, yearsOfExperience } from "@/lib/shop-content";

/** Big counter that climbs to the years of experience when it scrolls into view. */
export default function HomeYears() {
  const target = yearsOfExperience();
  const [value, setValue] = useState(target);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setValue(0);
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1400);
        setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [target]);
  return (
    <section ref={box} className="h-years" aria-labelledby="years-title">
      <p className="h-years-number" aria-hidden="true">{value}</p>
      <div className="h-years-copy">
        <h2 id="years-title"><span className="sr-only">{target} </span>ans de savoir-faire, depuis {shopContent.foundedYear}.</h2>
        <p>Des recettes que nos clients reviennent chercher, parce qu’elles leur conviennent. Et une réponse pour chaque question.</p>
        <Link href="/shop/about" className="h-btn h-btn-cream">Notre histoire <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
