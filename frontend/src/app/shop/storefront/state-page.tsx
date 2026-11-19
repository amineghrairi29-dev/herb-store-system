import "./state-page.css";

export type StateArt = "jar" | "mortar";

/** Hand-drawn scenes in the shop's line style: a tipped-over jar (page not found) and a mortar (error). */
function Art({ art }: { art: StateArt }) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg className="sp-art" viewBox="0 0 220 150" aria-hidden="true" focusable="false">
      <path d="M14 132h192" {...line} className="sp-ground" />
      {art === "jar" ? (
        <>
          <g className="sp-jar">
            <path d="M58 92c0-16 12-28 28-28h34c16 0 28 12 28 28v4c0 16-12 28-28 28H86c-16 0-28-12-28-28z" {...line} />
            <path d="M148 80h12v28h-12" {...line} />
            <path d="M74 84h54" {...line} className="sp-label" />
          </g>
          <path className="sp-leaf sp-leaf-1" d="M168 118c8-14 22-18 34-14-6 12-20 18-34 14z" fill="currentColor" />
          <path className="sp-leaf sp-leaf-2" d="M182 128c4-9 12-12 20-10-3 8-12 12-20 10z" fill="currentColor" />
          <circle className="sp-seed" cx="174" cy="130" r="2.6" fill="currentColor" />
          <circle className="sp-seed" cx="194" cy="131" r="2" fill="currentColor" />
          <path className="sp-ask" d="M98 36c0-7 6-12 12-12s12 5 12 11c0 8-10 9-10 16M112 58v.5" {...line} />
        </>
      ) : (
        <>
          <g className="sp-pestle">
            <path d="M128 18l-30 62" {...line} strokeWidth={9} />
          </g>
          <path d="M54 82h112c0 26-22 44-56 44S54 108 54 82z" {...line} />
          <path d="M84 126l-6 6h64l-6-6" {...line} />
          <path className="sp-leaf sp-leaf-1" d="M62 74c4-12 16-18 28-16-4 10-16 16-28 16z" fill="currentColor" />
          <path className="sp-puff sp-puff-1" d="M150 60c6-4 6-10 0-14" {...line} />
          <path className="sp-puff sp-puff-2" d="M164 64c8-6 8-14 0-20" {...line} />
        </>
      )}
    </svg>
  );
}

/**
 * Full-width message page of the shop (page not found, error): drawing, Arabic line,
 * title, explanation and up to three actions. Actions are passed as children.
 */
export default function StatePage({
  art,
  code,
  ar,
  title,
  text,
  children,
  role,
}: {
  art: StateArt;
  code?: string;
  ar: string;
  title: string;
  text: string;
  children: React.ReactNode;
  role?: "alert";
}) {
  return (
    <section className="sp" role={role} aria-labelledby="sp-title">
      <div className="sp-card">
        <Art art={art} />
        {code && <p className="sp-code">{code}</p>}
        <p lang="ar" dir="rtl" className="sp-ar">
          {ar}
        </p>
        <h1 id="sp-title" className="sp-title">
          {title}
        </h1>
        <p className="sp-text">{text}</p>
        <div className="sp-actions">{children}</div>
      </div>
    </section>
  );
}
