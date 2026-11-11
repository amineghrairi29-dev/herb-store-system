"use client";
import { useEffect, useRef, useState } from "react";

const steps = [
  ["Sélection", "Des plantes choisies une à une, à la bonne saison."],
  ["Séchage", "À l’ombre et à l’air, pour garder leur parfum et leur couleur."],
  ["Préparation", "Les mélanges de Slouma, pesés et dosés à la boutique."],
  ["Livraison", "Chez vous, emballé avec soin, payé à la réception."],
] as const;

/**
 * "De la récolte à votre tasse": the left column stays pinned while the four steps
 * scroll past; the one in the middle of the screen lights up and fills the progress bar.
 */
export default function HomeStory() {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
    }, { rootMargin: "-45% 0px -45% 0px" });
    items.current.forEach((item) => item && observer.observe(item));
    return () => observer.disconnect();
  }, []);
  return (
    <section className="h-section h-story" aria-labelledby="story-title">
      <div className="h-story-pin">
        <p className="h-eyebrow">De la récolte à votre tasse</p>
        <h2 id="story-title">Chaque recette passe par nos mains.</h2>
        <p className="h-story-text">Depuis 2006, la même exigence : savoir d’où vient chaque plante et comment la préparer.</p>
        <div className="h-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(active + 1) / steps.length})` }} /></div>
        <p className="h-story-count" aria-live="polite">Étape {active + 1} sur {steps.length} · {steps[active][0]}</p>
      </div>
      <ol className="h-steps">
        {steps.map(([name, text], index) => (
          <li key={name} ref={(element) => { items.current[index] = element; }} data-step={index} data-active={index === active || undefined} className="h-step">
            <span className="h-step-number">{String(index + 1).padStart(2, "0")}</span>
            <h3>{name}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
