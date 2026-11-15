"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SloumaStamp } from "@/components/brand/slouma-logo";
import { Leaf } from "../storefront/leaf";
import "./customer-auth.css";
import { useRouter } from "next/navigation";
import { apiBase } from "@/lib/api-base";
import { safeCustomerReturn, useCustomerAuth } from "../customer-auth-provider";
export default function CustomerAuth({
  returnTo,
  googleError,
  entry = false,
}: {
  returnTo: string;
  googleError: boolean;
  entry?: boolean;
}) {
  const router = useRouter(),
    auth = useCustomerAuth(),
    locked = useRef(false);
  const target = safeCustomerReturn(returnTo);
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [google, setGoogle] = useState(false),
    [password, setPassword] = useState(""),
    [shown, setShown] = useState(false);
  const rules = [
    { label: "8 caractères", ok: password.length >= 8 },
    { label: "une lettre", ok: /[a-zA-Z]/.test(password) },
    { label: "un chiffre", ok: /[0-9]/.test(password) },
  ];
  const [error, setError] = useState(
    googleError
      ? "Connexion Google impossible ou annulée. Réessayez ou connectez-vous avec votre email."
      : "",
  );
  useEffect(() => {
    if (!auth.loading && auth.customer) router.replace(target);
  }, [auth.loading, auth.customer, router, target]);
  useEffect(() => {
    const c = new AbortController();
    void fetch(`${apiBase}/public/auth/config`, { signal: c.signal })
      .then(async (r) => {
        if (r.ok) {
          const data: { googleEnabled: boolean } = await r.json();
          setGoogle(data.googleEnabled);
        }
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = new FormData(event.currentTarget),
      email = String(form.get("email") || "").trim(),
      password = String(form.get("password") || "");
    if (
      register &&
      (password.length < 8 ||
        !/[a-zA-Z]/.test(password) ||
        !/[0-9]/.test(password) ||
        new TextEncoder().encode(password).length > 72)
    ) {
      setError(
        "Utilisez au moins 8 caractères, une lettre et un chiffre (72 octets maximum).",
      );
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBase}/public/auth/${register ? "register" : "sign-in"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            email,
            password,
            ...(!register ? { returnTo: target } : {}),
            ...(register
              ? {
                  fullName: String(form.get("fullName") || "").trim() || null,
                  phone: String(form.get("phone") || "").trim() || null,
                }
              : {}),
          }),
        },
      );
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        throw new Error(
          data &&
            typeof data === "object" &&
            "message" in data &&
            typeof data.message === "string"
            ? data.message
            : "Connexion impossible. Réessayez.",
        );
      }
      if (!register) {
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('redirectTo' in result) || typeof result.redirectTo !== 'string')
          throw new Error('Connexion impossible. Réessayez.');
        // Reload providers from their separate session cookies; keep the browser cart intact.
        window.location.assign(result.redirectTo === '/dashboard' ? '/dashboard' : safeCustomerReturn(result.redirectTo));
        return;
      }
      if (!(await auth.refresh()))
        throw new Error("Votre session n’a pas pu être confirmée. Réessayez.");
      router.replace(target);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : "Erreur réseau.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const field = "ca-input";
  const switchTo = (value: boolean) => { setRegister(value); setError(""); };
  return (
    <section className="customer-auth">
      <aside className="ca-visual" aria-label="دار سلومة">
        <span className="ca-blob" aria-hidden="true" />
        <div className="ca-photo" aria-hidden="true"><Image src="/images/shop/hero/hero-main.png" alt="" fill sizes="(max-width: 899px) 0px, 30vw" className="ca-visual-image" preload /></div>
        <span className="ca-leaf ca-leaf-1" aria-hidden="true"><Leaf color="#A9C68F" /></span>
        <span className="ca-leaf ca-leaf-2" aria-hidden="true"><Leaf color="#D99A2B" vein="rgb(31 42 26 / .35)" /></span>
        <span className="ca-leaf ca-leaf-3" aria-hidden="true"><Leaf color="#3E7B3A" vein="rgb(255 255 255 / .35)" /></span>
        <div className="ca-visual-copy">
          <span className="ca-stamp" aria-hidden="true"><SloumaStamp size={92} tone="cream" /></span>
          <p lang="ar" dir="rtl" className="ca-ar">مرحبا بيك في دار سلومة</p>
          <p className="ca-visual-title">Votre compte,<br /><em>vos recettes.</em></p>
          <ul className="ca-perks">
            <li><span aria-hidden="true">✓</span>Toutes vos commandes et leur suivi</li>
            <li><span aria-hidden="true">✓</span>Adresse remplie d’avance à la commande</li>
            <li><span aria-hidden="true">✓</span>Le compte reste facultatif pour commander</li>
          </ul>
        </div>
      </aside>
      <div className="ca-form-panel">
      <div className="ca-form-inner">
      <div className="ca-top">
        <Link href="/shop" className="ca-home" aria-label="Retour à la boutique"><span aria-hidden="true">←</span><span lang="ar" dir="rtl" className="ca-name">دار سلومة</span></Link>
      </div>
      <h1 className="ca-title">{register ? "Créer un compte" : "Bon retour parmi nous"}</h1>
      <p className="ca-sub">{register ? "Une minute suffit. Seuls l’email et le mot de passe sont obligatoires." : "Connectez-vous pour retrouver vos commandes."}</p>
      <div className="ca-switch" data-register={register} role="group" aria-label="Accès au compte">
        <span className="ca-tab-indicator" aria-hidden="true" />
        <button type="button" disabled={busy} aria-pressed={!register} onClick={() => switchTo(false)}>Connexion</button>
        <button type="button" disabled={busy} aria-pressed={register} onClick={() => switchTo(true)}>Inscription</button>
      </div>
      <form onSubmit={submit} className="ca-form">
        <fieldset disabled={busy} className="ca-fields">
          <legend className="sr-only">{register ? "Créer un compte" : "Se connecter"}</legend>
          <label className="ca-label">
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} className={field} placeholder="vous@exemple.com" />
          </label>
          <label className="ca-label">
            Mot de passe
            <span className="ca-password">
              <input name="password" type={shown ? "text" : "password"} required minLength={register ? 8 : undefined} maxLength={72} autoComplete={register ? "new-password" : "current-password"} className={field} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={register ? "ca-rules" : undefined} />
              <button type="button" className="ca-eye" onClick={() => setShown((value) => !value)} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={shown}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />{shown && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}</svg>
              </button>
            </span>
          </label>
          {register && (
            <>
              <ul id="ca-rules" className="ca-rules" aria-label="Le mot de passe doit contenir">
                {rules.map((rule) => <li key={rule.label} data-ok={rule.ok}><span aria-hidden="true">{rule.ok ? "✓" : "•"}</span>{rule.label}<span className="sr-only">{rule.ok ? " : fait" : " : à faire"}</span></li>)}
              </ul>
              <div className="ca-pair">
                <label className="ca-label">
                  Nom <span className="ca-optional">(facultatif)</span>
                  <input name="fullName" maxLength={150} autoComplete="name" className={field} dir="auto" />
                </label>
                <label className="ca-label">
                  Téléphone <span className="ca-optional">(facultatif)</span>
                  <input name="phone" type="tel" inputMode="tel" maxLength={40} autoComplete="tel" className={field} placeholder="98 123 456" />
                </label>
              </div>
            </>
          )}
          <button className="ca-primary" type="submit">
            {busy ? <><span className="ca-spinner" aria-hidden="true" />{register ? "Création…" : "Connexion…"}</> : <>{register ? "Créer mon compte" : "Se connecter"} <span aria-hidden="true">→</span></>}
          </button>
        </fieldset>
      </form>
      {(error || auth.error) && (
        <p role="alert" className="ca-error">{error || auth.error}</p>
      )}
      {google && (
        <>
          <p className="ca-divider"><span>ou</span></p>
          <a
            aria-disabled={busy}
            onClick={(e) => { if (busy) e.preventDefault(); }}
            className="ca-google"
            href={`${apiBase}/public/auth/google/start?${new URLSearchParams({ returnTo: target, ...(entry ? { entry: 'true' } : {}) })}`}
          >
            <svg className="ca-google-icon" aria-hidden="true" focusable="false" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.18v5.14h6.61c3.87-3.56 6.08-8.8 6.08-14.82Z" />
              <path fill="#34A853" d="M24 44c5.4 0 9.93-1.79 13.24-4.85l-6.61-5.14c-1.79 1.2-4.08 1.93-6.63 1.93-5.2 0-9.61-3.51-11.19-8.23H5.99v5.3A20 20 0 0 0 24 44Z" />
              <path fill="#FBBC05" d="M12.81 27.71a12 12 0 0 1 0-7.42v-5.3H5.99a20 20 0 0 0 0 18.02l6.82-5.3Z" />
              <path fill="#EA4335" d="M24 12.06c2.94 0 5.56 1.01 7.64 2.98l5.72-5.72A19.2 19.2 0 0 0 24 4a20 20 0 0 0-18.01 10.99l6.82 5.3C14.39 15.57 18.8 12.06 24 12.06Z" />
            </svg>
            <span>Continuer avec Google</span>
          </a>
        </>
      )}
      <Link href="/shop" className="ca-visitor">{entry ? "Continuer en tant que visiteur" : "Commander sans compte"} <span aria-hidden="true">→</span></Link>
      </div>
      </div>
    </section>
  );
}
