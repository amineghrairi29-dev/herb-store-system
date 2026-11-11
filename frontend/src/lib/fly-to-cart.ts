/**
 * Small visual cue after "Ajouter au panier": a round thumbnail flies from the button
 * to the header cart (marked data-cart-target), then the cart badge pops.
 * Skipped when the device asks for less motion or when no cart is on screen.
 */
export function flyToCart(from: Element | null, imageUrl?: string | null) {
  if (typeof window === "undefined" || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = Array.from(document.querySelectorAll("[data-cart-target]")).find((element) => element.getClientRects().length > 0);
  if (!target) return;
  const start = from.getBoundingClientRect(), end = target.getBoundingClientRect();
  const size = 56;
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, {
    position: "fixed", zIndex: "100", left: `${start.left + start.width / 2 - size / 2}px`, top: `${start.top + start.height / 2 - size / 2}px`,
    width: `${size}px`, height: `${size}px`, borderRadius: "50%", pointerEvents: "none",
    background: imageUrl ? `#eef4e4 center / cover no-repeat url("${imageUrl}")` : "#d99a2b",
    boxShadow: "0 10px 24px rgb(31 58 36 / 0.3)", border: "3px solid #fff",
  });
  document.body.appendChild(dot);
  const dx = end.left + end.width / 2 - (start.left + start.width / 2), dy = end.top + end.height / 2 - (start.top + start.height / 2);
  // Curved path: up first, then down into the cart.
  const animation = dot.animate([
    { transform: "translate(0, 0) scale(1)", opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(0.8)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.6 },
  ], { duration: 750, easing: "cubic-bezier(0.45, 0, 0.2, 1)" });
  animation.onfinish = () => dot.remove();
  animation.oncancel = () => dot.remove();
}
