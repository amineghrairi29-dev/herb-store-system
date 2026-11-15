"use client";
import { useEffect, useRef, useState } from "react";
import { mapLinks, shopContent } from "@/lib/shop-content";
import OpenStatus from "./open-status";
import "./shop-map.css";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * "Comment venir" block: address, landmark, hours and the two Google Maps buttons, next
 * to a map. The Google map loads when the block comes near the screen (the page stays
 * light); until then a drawn map with the pin stands in, and a tap loads it at once.
 */
export default function ShopMap({ address }: { address?: string | null }) {
  const [live, setLive] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setLive(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { landmark, landmarkAr } = shopContent.location;
  return (
    <section className="sm" aria-labelledby="sm-title">
      <div className="sm-info">
        <p lang="ar" dir="rtl" className="sm-ar">كيفاش توصلنا؟</p>
        <h2 id="sm-title">Venir à la boutique</h2>
        <ul className="sm-facts">
          <li>
            <span className="sm-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" {...stroke} /><circle cx="12" cy="9.5" r="2.5" {...stroke} /></svg></span>
            <span><strong>{address || "Ghannouch, Gabès"}</strong><span className="sm-landmark">{landmark}<span lang="ar" dir="rtl">{landmarkAr}</span></span></span>
          </li>
          <li>
            <span className="sm-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M12 7.5V12l3 2" {...stroke} /></svg></span>
            <span><strong>{shopContent.openingHours.map((row) => row.hours).join(" ")}</strong><span className="sm-landmark">{shopContent.openingHours.map((row) => row.days).join(" · ")} <OpenStatus /></span></span>
          </li>
        </ul>
        <div className="sm-actions">
          <a href={mapLinks.directions} target="_blank" rel="noopener noreferrer" className="sm-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8-8-2Z" {...stroke} /></svg>
            Itinéraire
          </a>
          <a href={mapLinks.view} target="_blank" rel="noopener noreferrer" className="sm-btn sm-btn-line">Ouvrir dans Google Maps <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div ref={box} className="sm-map">
        {live ? (
          <iframe src={mapLinks.embed} title="Carte : boutique Dar Slouma à Ghannouch, à côté du bureau de poste" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        ) : (
          <button type="button" className="sm-placeholder" onClick={() => setLive(true)} aria-label="Afficher la carte Google Maps">
            <svg className="sm-drawn" viewBox="0 0 400 300" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
              <rect width="400" height="300" fill="#EEF4E4" />
              <path d="M-20 210 C 80 180, 140 230, 240 190 S 380 150, 430 170" stroke="#fff" strokeWidth="26" fill="none" />
              <path d="M150 -20 C 170 80, 130 160, 180 320" stroke="#fff" strokeWidth="20" fill="none" />
              <path d="M-20 90 L 430 60" stroke="#fff" strokeWidth="14" fill="none" />
              <path d="M290 -10 L 330 320" stroke="#fff" strokeWidth="12" fill="none" />
              <rect x="40" y="110" width="80" height="50" rx="8" fill="#DCE3D2" />
              <rect x="210" y="85" width="64" height="70" rx="8" fill="#DCE3D2" />
              <rect x="300" y="200" width="70" height="60" rx="8" fill="#C9DDB4" />
              <rect x="30" y="230" width="90" height="50" rx="8" fill="#C9DDB4" />
            </svg>
            <span className="sm-post" aria-hidden="true">Poste</span>
            <span className="sm-pin" aria-hidden="true"><svg viewBox="0 0 40 52"><path d="M20 51S3 33 3 20a17 17 0 0 1 34 0c0 13-17 31-17 31Z" fill="#3E7B3A" stroke="#fff" strokeWidth="3" /><circle cx="20" cy="20" r="7" fill="#F2C46B" /></svg></span>
            <span className="sm-label" aria-hidden="true"><span lang="ar" dir="rtl">دار سلومة</span></span>
            <span className="sm-load">Afficher la carte</span>
          </button>
        )}
      </div>
    </section>
  );
}
