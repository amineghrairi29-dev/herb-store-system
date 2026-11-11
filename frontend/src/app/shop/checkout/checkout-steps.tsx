import Link from "next/link";
import "./checkout-steps.css";

const steps = [
  { label: "Panier", href: "/shop/cart" },
  { label: "Coordonnées", href: "/shop/checkout" },
  { label: "Confirmation", href: null },
] as const;

/** 1 Panier → 2 Coordonnées → 3 Confirmation. Earlier steps are links (except after the order is sent). */
export default function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav className="ck-steps" aria-label="Étapes de la commande" style={{ "--progress": (current - 1) / (steps.length - 1) } as React.CSSProperties}>
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          const state = number < current ? "done" : number === current ? "current" : "next";
          const body = <><span className="ck-dot" aria-hidden="true">{state === "done" ? "✓" : number}</span><span className="ck-label">{step.label}</span></>;
          return (
            <li key={step.label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              {state === "done" && step.href && current < 3 ? <Link href={step.href}>{body}</Link> : <span>{body}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
