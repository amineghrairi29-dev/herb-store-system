"use client";
import Image from 'next/image';
import Link from 'next/link';
import StoreName from '@/components/store-name';
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./customer-auth.css";
import BackLink from "../back-link";
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
    [google, setGoogle] = useState(false);
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
  return (
    <section className="customer-auth">
      <aside className="ca-visual" aria-label="L’univers de la boutique">
        <Image src="/images/shop/hero/hero-main.png" alt="Herbes aromatiques, mortier et huile botanique" fill sizes="(max-width: 759px) 100vw, 50vw" className="ca-visual-image" preload />
        <div className="ca-visual-copy"><p className="ca-brand"><StoreName /></p><p className="ca-visual-title">Le naturel,<br /><em>tout simplement.</em></p><span>Votre sélection, à portée de main.</span></div>
      </aside>
      <div className="ca-form-panel">
      <div className="ca-form-inner">
      <BackLink href="/shop">Retour à la boutique</BackLink>
      <div className="ca-heading" aria-hidden="true" />
      <div className="ca-switch" data-register={register} role="group" aria-label="Accès au compte">
        <span className="ca-tab-indicator" aria-hidden="true" />
        <button type="button" disabled={busy} aria-pressed={!register} onClick={() => { setRegister(false); setError(""); }}>Connexion</button>
        <button type="button" disabled={busy} aria-pressed={register} onClick={() => { setRegister(true); setError(""); }}>Inscription</button>
      </div>
      <form onSubmit={submit} className="ca-form">
        <fieldset disabled={busy} className="ca-fields">
          <legend className="sr-only">
            {register ? "Créer un compte" : "Se connecter"}
          </legend>
          <label className="ca-label">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className={field}
            />
          </label>
          <label className="ca-label">
            Mot de passe
            <input
              name="password"
              type="password"
              required
              minLength={register ? 8 : undefined}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
              className={field}
            />
          </label>
          {register && (
            <>
              <p className="ca-help">
                Au moins 8 caractères, une lettre et un chiffre.
              </p>
              <label className="ca-label">
                Nom complet (facultatif)
                <input
                  name="fullName"
                  maxLength={150}
                  autoComplete="name"
                  className={field}
                />
              </label>
              <label className="ca-label">
                Téléphone (facultatif)
                <input
                  name="phone"
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  className={field}
                />
              </label>
            </>
          )}
          <button
            className="ca-primary"
            type="submit"
          >
            {busy
              ? "Connexion..."
              : register
                ? "Créer un compte"
                : "Se connecter"}
          </button>
        </fieldset>
      </form>
      {google && (
        <>
          <p className="ca-divider"><span>ou</span></p>
          <a
            aria-disabled={busy}
            onClick={(e) => {
              if (busy) e.preventDefault();
            }}
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
      {entry && <Link href="/shop" className="ca-visitor">Continuer en tant que visiteur</Link>}
      {(error || auth.error) && (
        <p role="alert" className="ca-error">
          {error || auth.error}
        </p>
      )}
      </div>
      </div>
    </section>
  );
}
