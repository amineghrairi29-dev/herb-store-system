"use client";
import { useEffect, useState } from "react";
import { apiBase } from "@/lib/api-base";
import { isStoreInfo, whatsappLink } from "@/lib/store-info";
import "./whatsapp-button.css";

/** Floating WhatsApp shortcut; hidden until the shop phone is set in the settings. */
export default function WhatsAppButton() {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/public/store-info`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (isStoreInfo(value)) setHref(whatsappLink(value.phone, "Bonjour, j’ai une question sur un produit."));
      })
      .catch(() => { /* Optional shortcut: no error shown. */ });
    return () => controller.abort();
  }, []);
  if (!href) return null;
  return (
    <a className="sf-whatsapp" href={href} target="_blank" rel="noopener noreferrer" aria-label="Nous écrire sur WhatsApp">
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
      </svg>
    </a>
  );
}
