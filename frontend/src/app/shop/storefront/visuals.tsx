export function LeafIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
      <path
        d="M8 24C2 11 16 5 27 5c1 12-6 24-19 19Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m5 29 16-17M12 22l-1-8m6 3h7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function HeroVisualPlaceholder() {
  return (
    <div
      className="sf-hero-visual"
      aria-hidden="true"
      data-placeholder="HERO IMAGE PLACEHOLDER"
    >
      <div className="sf-visual-orbit" />
      <div className="sf-visual-arch">
        <LeafIcon />
      </div>
      <div className="sf-visual-disc" />
      <span className="sf-visual-caption">L’essentiel, au naturel.</span>
    </div>
  );
}
export function ProductImagePlaceholder() {
  return (
    <div
      className="sf-product-visual"
      aria-hidden="true"
      data-placeholder="PRODUCT IMAGE PLACEHOLDER"
    >
      <LeafIcon />
    </div>
  );
}
