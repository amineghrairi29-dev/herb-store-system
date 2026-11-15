import { useId } from "react";

/** Brand colors of the approved "Feuille et miel" theme. */
const leaf = "#3E7B3A", cream = "#FBFAF5", honey = "#F2C46B";

function Mortar({ x, y, scale, color, accent }: { x: number; y: number; scale: number; color: string; accent: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M18 52h74c0 22-16 38-37 38S18 74 18 52Z" fill={color} />
      <rect x="14" y="46" width="82" height="8" rx="4" fill={color} opacity="0.85" />
      <path d="M66 46 88 12" stroke={accent} strokeWidth="7" strokeLinecap="round" />
      <path d="M40 44c-2-12 4-24 14-30-1 12-5 22-14 30Z" fill={color} opacity="0.8" />
      <path d="M48 44c4-10 12-16 22-17-5 9-12 15-22 17Z" fill={color} opacity="0.8" />
    </g>
  );
}

/** Full stamp: "Ghannouch · Gabès" on the top arc, mortar, سلومة, Herboristerie, 2006. */
export function SloumaStamp({ size = 96, tone = "leaf", className }: { size?: number; tone?: "leaf" | "cream"; className?: string }) {
  const arc = useId().replace(/:/g, "");
  const fill = tone === "leaf" ? leaf : cream, ink = tone === "leaf" ? cream : leaf;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 220 220" role="img" aria-label="Herboristerie Slouma, Ghannouch Gabès, depuis 2006">
      <defs><path id={arc} d="M28,110 A82,82 0 0,1 192,110" /></defs>
      <circle cx="110" cy="110" r="108" fill={fill} />
      <circle cx="110" cy="110" r="100" fill="none" stroke={ink} strokeWidth="2" />
      <circle cx="110" cy="110" r="94" fill="none" stroke={ink} strokeWidth="0.8" />
      <text fontFamily="var(--font-body), sans-serif" fontSize="11" fontWeight="600" letterSpacing="3" fill={ink}>
        <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">GHANNOUCH · GABÈS</textPath>
      </text>
      <Mortar x={77} y={50} scale={0.6} color={ink} accent={honey} />
      <text x="110" y="138" textAnchor="middle" fontFamily="var(--font-arabic), serif" fontSize="44" fill={ink}>سلومة</text>
      <text x="110" y="162" textAnchor="middle" fontFamily="var(--font-display), serif" fontSize="16" fill={ink}>Herboristerie</text>
      <text x="110" y="184" textAnchor="middle" fontFamily="var(--font-body), sans-serif" fontSize="10" letterSpacing="3" fill={tone === "leaf" ? honey : "#B07A1E"}>— 2006 —</text>
    </svg>
  );
}

/** Small mark for tight spaces (mobile header, favicon-size): the mortar in a ring. */
export function SloumaIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <circle cx="64" cy="64" r="62" fill={leaf} />
      <circle cx="64" cy="64" r="54" fill="none" stroke={cream} strokeWidth="3" />
      <Mortar x={20} y={18} scale={0.8} color={cream} accent={honey} />
    </svg>
  );
}
