"use client";
import "./confirmation.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "../cart-provider";
import { apiBase } from "@/lib/api-base";
import { displayAmount } from "@/lib/purchase-decimal";
import { isStoreInfo, whatsappLink } from "@/lib/store-info";
import { orderStatusLabels, type OrderReceipt } from "@/types/online-order";
import CheckoutSteps from "../checkout/checkout-steps";
import { Leaf } from "../storefront/leaf";

const next = [
  { title: "On vous appelle", text: "Le magasin vous téléphone pour confirmer la commande et l’adresse." },
  { title: "On prépare", text: "Vos plantes et recettes sont pesées et emballées à la boutique." },
  { title: "On livre", text: "Vous payez en espèces à la réception, rien avant." },
];
const fall = [
  ["#A9C68F", 8, 0],
  ["#3E7B3A", 22, 0.6],
  ["#D99A2B", 38, 0.2],
  ["#C9DDB4", 56, 0.9],
  ["#3E7B3A", 72, 0.4],
  ["#A9C68F", 88, 1.1],
] as const;

export default function Success() {
  const { receipt } = useCart(),
    [saved, setSaved] = useState<OrderReceipt | null>(null);
  const [copied, setCopied] = useState(false),
    [whatsapp, setWhatsapp] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const value: unknown = JSON.parse(sessionStorage.getItem("herb-store-order-receipt-v1") ?? "null");
        if (
          value &&
          typeof value === "object" &&
          "reference" in value &&
          typeof value.reference === "string" &&
          /^ORD-\d+$/.test(value.reference) &&
          "totalAmount" in value &&
          typeof value.totalAmount === "string" &&
          /^\d+(?:\.\d+)?$/.test(value.totalAmount) &&
          "status" in value &&
          typeof value.status === "string" &&
          Object.hasOwn(orderStatusLabels, value.status)
        )
          setSaved(value as OrderReceipt);
      } catch {
        /* A missing receipt never triggers another order request. */
      }
    });
  }, []);
  const order = receipt ?? saved;
  useEffect(() => {
    if (!order) return;
    const controller = new AbortController();
    fetch(`${apiBase}/public/store-info`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (isStoreInfo(value))
          setWhatsapp(whatsappLink(value.phone, `Bonjour, j’ai passé la commande ${order.reference}.`));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [order]);
  async function copy(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard refused: the reference stays visible. */
    }
  }

  if (!order)
    return (
      <section className="order-confirmation oc-missing" aria-labelledby="confirmation-title">
        <CheckoutSteps current={3} />
        <div className="oc-card">
          <p lang="ar" dir="rtl" className="oc-ar">
            ما ثمّاش كوموند هنا
          </p>
          <h1 id="confirmation-title">Aucune confirmation dans cet onglet</h1>
          <p className="oc-intro">
            Si vous venez de commander, votre commande est bien enregistrée : actualiser la page n’en crée pas une
            nouvelle. Retrouvez-la avec sa référence.
          </p>
          <div className="oc-actions">
            <Link href="/shop/suivi" className="oc-primary">
              Suivre une commande
            </Link>
            <Link href="/shop" className="oc-secondary">
              Retour à la boutique
            </Link>
          </div>
        </div>
      </section>
    );

  return (
    <section className="order-confirmation" aria-labelledby="confirmation-title">
      <CheckoutSteps current={3} />
      <div className="oc-card">
        <div className="oc-fall" aria-hidden="true">
          {fall.map(([color, left, delay], index) => (
            <span key={index} style={{ left: `${left}%`, animationDelay: `${delay}s` }}>
              <Leaf color={color} />
            </span>
          ))}
        </div>
        <div className="oc-icon" aria-hidden="true">
          <svg viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="24" />
            <path d="m15 27 7 7 15-16" />
          </svg>
        </div>
        <p lang="ar" dir="rtl" className="oc-ar">
          يعيشك، الكوموند وصلتنا!
        </p>
        <h1 id="confirmation-title">Merci, votre commande est envoyée</h1>
        <p className="oc-intro">Gardez votre référence : elle sert à suivre la commande ou à nous en parler.</p>
        <div className="oc-receipt">
          <div className="oc-ref">
            <span>Référence</span>
            <strong>
              <bdi>{order.reference}</bdi>
            </strong>
            <button type="button" onClick={() => void copy(order.reference)} aria-live="polite">
              {copied ? "Copiée ✓" : "Copier"}
            </button>
          </div>
          <div className="oc-amount">
            <span>À payer à la livraison</span>
            <strong>
              {displayAmount(order.totalAmount)} <small>TND</small>
            </strong>
          </div>
        </div>
        <ol className="oc-next" aria-label="La suite">
          {next.map((step, index) => (
            <li key={step.title} style={{ "--i": index } as React.CSSProperties}>
              <span className="oc-next-num" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="oc-actions">
          <Link href={`/shop/suivi?ref=${encodeURIComponent(order.reference)}`} className="oc-primary">
            Suivre ma commande <span aria-hidden="true">→</span>
          </Link>
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="oc-secondary">
              Une question ? WhatsApp
            </a>
          )}
        </div>
        <Link href="/shop" className="oc-back">
          Retour à la boutique
        </Link>
      </div>
    </section>
  );
}
