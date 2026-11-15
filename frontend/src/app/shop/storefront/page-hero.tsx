import type { ReactNode } from "react";
import { Leaf } from "./leaf";

/**
 * Top of the information pages (about, contact, FAQ, delivery, legal): Arabic line,
 * title and lead on a soft tinted panel with a breathing blob and two leaves.
 */
export default function PageHero({ ar, eyebrow, title, lead, children, tone = "sprout", compact = false }: {
  ar: string; eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode;
  tone?: "sprout" | "honey" | "clay"; compact?: boolean;
}) {
  return (
    <header className="ip-hero" data-tone={tone} data-compact={compact || undefined}>
      <span className="ip-hero-blob" aria-hidden="true" />
      <span className="ip-hero-leaf ip-hero-leaf-1" aria-hidden="true"><Leaf color="#3E7B3A" /></span>
      <span className="ip-hero-leaf ip-hero-leaf-2" aria-hidden="true"><Leaf color="#D99A2B" vein="rgb(31 42 26 / .35)" /></span>
      <div className="ip-hero-copy">
        <p className="ip-eyebrow ip-in" style={{ "--i": 0 } as React.CSSProperties}>{eyebrow}</p>
        <p lang="ar" dir="rtl" className="ip-ar ip-in" style={{ "--i": 1 } as React.CSSProperties}>{ar}</p>
        <h1 className="ip-in" style={{ "--i": 2 } as React.CSSProperties}>{title}</h1>
        {lead && <p className="ip-lead ip-in" style={{ "--i": 3 } as React.CSSProperties}>{lead}</p>}
        {children && <div className="ip-hero-actions ip-in" style={{ "--i": 4 } as React.CSSProperties}>{children}</div>}
      </div>
    </header>
  );
}
