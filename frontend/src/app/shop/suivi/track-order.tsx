"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiBase } from "@/lib/api-base";
import { displayAmount } from "@/lib/purchase-decimal";
import { tunisianPhone } from "@/lib/phone";
import { isStoreInfo, whatsappLink } from "@/lib/store-info";
import { customerOrderLabel, customerSteps, type DeliveryStatus, type OrderStatus } from "@/types/online-order";
import "./track-order.css";

interface Tracked { reference: string; status: OrderStatus; deliveryStatus: DeliveryStatus | null; grandTotal?: string; totalAmount: string; createdAt: string; items: { productNameSnapshot: string; quantity: string; unitSnapshot: string }[] }

const arabic = /[؀-ۿ]/;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** One icon per customer step, in the order of customerSteps. */
const icons = [
  <svg key="wait" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M12 7.5V12l3 2" {...stroke} /></svg>,
  <svg key="ok" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" {...stroke} strokeWidth={2.2} /></svg>,
  <svg key="prep" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16l-1.5 6.5A3 3 0 0 1 15.6 20H8.4a3 3 0 0 1-2.9-2.5L4 11Z M14 11l5-7" {...stroke} /></svg>,
  <svg key="road" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" {...stroke} /><circle cx="7" cy="17.5" r="1.8" {...stroke} /><circle cx="17" cy="17.5" r="1.8" {...stroke} /></svg>,
  <svg key="home" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-5h-6v5H4.5a.5.5 0 0 1-.5-.5V11Z" {...stroke} /></svg>,
];
const short = ["Reçue", "Confirmée", "Préparation", "En route", "Livrée"];

/** Guest order tracking: reference + phone, the same pair the shop asks for on the phone. */
export default function TrackOrder() {
  const [order, setOrder] = useState<Tracked | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const reference = useRef<HTMLInputElement>(null), phoneField = useRef<HTMLInputElement>(null), result = useRef<HTMLDivElement>(null);

  // ?ref=ORD-… (link from the confirmation page) fills the reference; the phone is asked again.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && reference.current && /^ORD-\d{6,10}$/.test(ref)) { reference.current.value = ref; phoneField.current?.focus(); }
    const controller = new AbortController();
    fetch(`${apiBase}/public/store-info`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => { if (isStoreInfo(value)) setWhatsapp(whatsappLink(value.phone, "Bonjour, une question sur ma commande.")); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => { if (order) result.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }); }, [order]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    const ref = String(fields.get("reference") ?? "").trim().toUpperCase().replace(/^(\d+)$/, "ORD-$1");
    const phone = tunisianPhone(String(fields.get("phone") ?? ""));
    if (!/^ORD-\d{6,10}$/.test(ref) || !phone) { setError("Vérifiez la référence (ex. ORD-000123) et le numéro de téléphone."); return; }
    setBusy(true); setError(""); setOrder(null);
    try {
      const response = await fetch(`${apiBase}/public/orders/${encodeURIComponent(ref)}?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
      if (response.status === 429) throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
      if (!response.ok) throw new Error("Aucune commande ne correspond à cette référence et ce numéro.");
      setOrder(await response.json() as Tracked);
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : "Erreur réseau."); }
    finally { setBusy(false); }
  }

  const label = order ? customerOrderLabel(order.status, order.deliveryStatus) : "";
  const step = customerSteps.indexOf(label as (typeof customerSteps)[number]);
  const date = order ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt)) : "";
  return (
    <section className="tr" aria-labelledby="tr-title">
      <header className="tr-heading">
        <p lang="ar" dir="rtl" className="tr-ar">وين وصلت الكوموند؟</p>
        <h1 id="tr-title">Suivre ma commande</h1>
        <p>La référence est sur la page de confirmation (elle commence par ORD-). Ajoutez le numéro donné à la commande.</p>
      </header>

      <form onSubmit={submit} className="tr-form" aria-describedby={error ? "tr-error" : undefined}>
        <label>Référence<input ref={reference} name="reference" required placeholder="ORD-000123" autoComplete="off" autoCapitalize="characters" spellCheck={false} /></label>
        <label>Téléphone<input ref={phoneField} name="phone" type="tel" inputMode="tel" required placeholder="98 123 456" autoComplete="tel" /></label>
        <button disabled={busy}>{busy ? <><span className="tr-spinner" aria-hidden="true" />Recherche…</> : <>Suivre <span aria-hidden="true">→</span></>}</button>
      </form>
      {error && <p id="tr-error" role="alert" className="tr-error">{error}</p>}

      {order && (
        <div ref={result} className="tr-result" aria-live="polite">
          <div className="tr-result-head">
            <div><span className="tr-small">Commande du {date}</span><h2><bdi>{order.reference}</bdi></h2></div>
            <span className="tr-badge" data-tone={step < 0 ? "stop" : step === customerSteps.length - 1 ? "done" : "live"}>{label}</span>
          </div>

          {step >= 0 ? (
            <ol className="tr-steps" style={{ "--progress": step / (customerSteps.length - 1) } as React.CSSProperties}>
              {customerSteps.map((name, index) => (
                <li key={name} data-state={index < step ? "done" : index === step ? "current" : "next"} aria-current={index === step ? "step" : undefined} style={{ "--i": index } as React.CSSProperties}>
                  <span className="tr-node">{icons[index]}</span>
                  <span className="tr-step-label"><span className="tr-long">{name}</span><span className="tr-short" aria-hidden="true">{short[index]}</span></span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="tr-stopped">{order.status === "CANCELLED" ? "Cette commande a été annulée." : "Cette commande nous a été retournée."} Pour toute question, écrivez-nous : on vous répond vite.</p>
          )}

          <div className="tr-details">
            <ul className="tr-items">
              {order.items.map((item, index) => { const isArabic = arabic.test(item.productNameSnapshot); return (
                <li key={index}><span className={isArabic ? "tr-name-ar" : undefined} {...(isArabic ? { lang: "ar", dir: "rtl" } : {})}>{item.productNameSnapshot}</span><span className="tr-qty">{item.quantity.replace(".", ",")} {item.unitSnapshot}</span></li>
              ); })}
            </ul>
            <div className="tr-total"><span>À payer à la livraison</span><strong>{displayAmount(order.grandTotal ?? order.totalAmount)} <small>TND</small></strong></div>
          </div>
        </div>
      )}

      <aside className="tr-help">
        <p><strong>Référence perdue ?</strong> Envoyez-nous votre nom et votre numéro, on la retrouve pour vous.</p>
        {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp</a> : <Link href="/shop/contact">Nous contacter</Link>}
      </aside>
    </section>
  );
}
