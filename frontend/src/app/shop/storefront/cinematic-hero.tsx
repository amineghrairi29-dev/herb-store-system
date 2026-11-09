"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import "./cinematic-hero.css";

const EASE = "cubic-bezier(.22,1,.36,1)";

export default function CinematicHero({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !Element.prototype.animate) return;
    const hero = root.querySelector<HTMLElement>('.sf-hero-banner')!;
    const visual = root.querySelector<HTMLElement>('.sf-hero-visual')!;
    const photo = root.querySelector<HTMLElement>('.sf-hero-image')!;
    const heading = root.querySelector<HTMLElement>('h1')!;
    const trust = root.querySelector<HTMLElement>('.sf-trust')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = matchMedia('(min-width: 1101px) and (pointer: fine)');
    const mobile = matchMedia('(max-width: 759px)').matches;
    const factor = mobile ? 0.65 : 1;
    const animations: Animation[] = [];
    const overlays: HTMLElement[] = [];
    let ended = false, visible = true, frame = 0, disposed = false;
    const originalHeadingStyle = heading.getAttribute('style');
    function restoreHeading() {
      if (originalHeadingStyle === null) heading.removeAttribute('style');
      else heading.setAttribute('style', originalHeadingStyle);
      overlays.forEach(element => element.remove());
    }
    function animate(element: Element, frames: Keyframe[], start: number, duration: number) {
      const animation = element.animate(frames, { delay: start * factor, duration: duration * factor, easing: EASE, fill: 'both' });
      animations.push(animation);
      return animation;
    }
    function finish() {
      ended = true;
      animations.forEach(animation => animation.cancel());
      restoreHeading();
      root!.dataset.intro = 'complete';
    }
    if (!reduced.matches) {
      root.dataset.intro = 'playing';
      // One timeline, shared easing and mobile time scale. No dimensions animate.
      animate(hero, [{ opacity: 0.96 }, { opacity: 1 }], 0, 600);
      animate(visual, [{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)' }], 0, 1100);
      animate(photo, [{ transform: mobile ? 'scale(1.02)' : 'translateX(8px) scale(1.04)' }, { transform: 'none' }], 0, 1200);
      animate(root.querySelector('.sf-eyebrow')!, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], 140, 500);

      // Mask copies of the actual laid-out heading: preserves responsive wrapping,
      // italic styling and the original accessible h1 without forced line breaks.
      const bounds = heading.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(heading).lineHeight);
      const count = Math.round(bounds.height / lineHeight);
      const overlay = document.createElement('div');
      overlay.className = 'sf-headline-masks';
      overlay.setAttribute('aria-hidden', 'true');
      const parent = heading.parentElement!;
      const parentBounds = parent.getBoundingClientRect();
      Object.assign(overlay.style, { top: `${bounds.top - parentBounds.top}px`, left: `${bounds.left - parentBounds.left}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
      for (let index = 0; index < count; index++) {
        const mask = document.createElement('div');
        mask.className = 'sf-headline-mask';
        Object.assign(mask.style, { top: `${index * lineHeight}px`, height: `${lineHeight}px` });
        const moving = document.createElement('div');
        Object.assign(moving.style, { height: `${lineHeight}px`, overflow: 'hidden' });
        const copy = heading.cloneNode(true) as HTMLElement;
        copy.removeAttribute('id');
        Object.assign(copy.style, { margin: '0', position: 'relative', top: `${-index * lineHeight}px`, width: `${bounds.width}px` });
        moving.append(copy); mask.append(moving); overlay.append(mask);
        animate(moving, [{ transform: `translateY(${lineHeight * 1.12}px)` }, { transform: 'none' }], 280 + index * 130, 780);
      }
      parent.append(overlay); overlays.push(overlay);
      heading.style.opacity = '0';
      animate(root.querySelector('.sf-hero-description')!, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], 900, 480);
      root.querySelectorAll('.sf-hero-actions > *').forEach((element, index) => {
        // CTAs remain visible and clickable from the first frame.
        animate(element, [{ opacity: 0.45, transform: 'translateX(-14px) scale(.98)' }, { opacity: 1, transform: 'none' }], 1040 + index * 100, 450);
      });
      for (const edge of ['top', 'bottom']) {
        const divider = document.createElement('span');
        divider.className = `sf-trust-reveal-line sf-trust-reveal-${edge}`;
        divider.setAttribute('aria-hidden', 'true'); trust.append(divider); overlays.push(divider);
        animate(divider, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 1120, 600);
      }
      trust.classList.add('sf-trust-revealing');
      trust.querySelectorAll(':scope > div').forEach((element, index) => {
        animate(element, [{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'none' }], 1300 + index * 80, 440);
        animate(element.querySelector('.sf-benefit-icon')!, [{ transform: 'translateY(3px)' }, { transform: 'none' }], 1380 + index * 80, 360);
      });
      void Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => { if (!disposed) { finish(); trust.classList.remove('sf-trust-revealing'); } });
    } else { ended = true; root.dataset.intro = 'complete'; }

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    function updateDepth() {
      frame = 0;
      if (!ended || !visible || reduced.matches || !desktop.matches || connection?.saveData || document.hidden) { photo.style.translate = ''; return; }
      const progress = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / hero.offsetHeight));
      photo.style.translate = `0 ${progress * 8}px`;
    }
    function schedule() { if (!frame && visible) frame = requestAnimationFrame(updateDepth); }
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); });
    observer.observe(hero);
    const onPreference = () => { if (reduced.matches) { finish(); trust.classList.remove('sf-trust-revealing'); } schedule(); };
    const onResize = () => { finish(); trust.classList.remove('sf-trust-revealing'); schedule(); };
    const onFocus = () => { finish(); trust.classList.remove('sf-trust-revealing'); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    root.addEventListener('focusin', onFocus);
    reduced.addEventListener('change', onPreference);
    desktop.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      disposed = true; finish(); trust.classList.remove('sf-trust-revealing'); photo.style.translate = '';
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', onResize);
      root.removeEventListener('focusin', onFocus); reduced.removeEventListener('change', onPreference);
      desktop.removeEventListener('change', schedule); document.removeEventListener('visibilitychange', schedule);
    };
  }, []);
  return <div ref={ref} className="sf-cinematic-top">{children}</div>;
}
