"use client";
import { useEffect, useState } from "react";

/**
 * Table of contents of a legal page, built from the h2 of the article next to it.
 * The section being read is highlighted. Hidden on a phone (the page is short there).
 */
export default function LegalToc({ articleId }: { articleId: string }) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState("");
  useEffect(() => {
    const article = document.getElementById(articleId);
    if (!article) return;
    const headings = [...article.querySelectorAll("h2")];
    headings.forEach((heading, index) => { if (!heading.id) heading.id = `section-${index + 1}`; });
    // Read after the first paint, once the article is in the page.
    const frame = requestAnimationFrame(() => setItems(headings.map((heading) => ({ id: heading.id, text: heading.textContent?.replace(/^\d+\.\s*/, "") ?? "" }))));
    if (!("IntersectionObserver" in window)) return () => cancelAnimationFrame(frame);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    headings.forEach((heading) => observer.observe(heading));
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [articleId]);
  if (!items.length) return <nav className="ip-toc" aria-hidden="true" />;
  return (
    <nav className="ip-toc" aria-label="Sommaire">
      <p>Sommaire</p>
      <ol>{items.map((item) => <li key={item.id}><a href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined}>{item.text}</a></li>)}</ol>
    </nav>
  );
}
