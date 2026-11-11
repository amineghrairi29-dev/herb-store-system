/** A drawn leaf, used as decoration (always hidden from screen readers). */
export function Leaf({ color, vein = "rgb(255 255 255 / .55)" }: { color: string; vein?: string }) {
  return (
    <svg viewBox="0 0 60 100" aria-hidden="true" focusable="false">
      <path d="M30 2C8 20 2 48 10 72c5 16 14 24 20 26 6-2 15-10 20-26 8-24 2-52-20-70Z" fill={color} />
      <path d="M30 96V14M30 40l-11-8M30 56l12-10M30 72l-10-8" stroke={vein} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
