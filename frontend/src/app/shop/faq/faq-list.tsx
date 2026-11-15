"use client";
import { useId, useState } from "react";

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Questions as an accordion, with a filter box that searches questions and answers. */
export default function FaqList({ questions }: { questions: [string, string][] }) {
  const [query, setQuery] = useState(""), id = useId();
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const shown = questions.filter(([question, answer]) => words.every((word) => normalize(`${question} ${answer}`).includes(word)));
  return (
    <div className="ip-faq-wrap">
      <label className="ip-faq-search" htmlFor={id}>
        <span className="sr-only">Chercher une question</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <input id={id} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Livraison, paiement, compte…" />
      </label>
      <p className="ip-faq-count" role="status">{query ? (shown.length ? `${shown.length} réponse${shown.length > 1 ? "s" : ""}` : "Aucune réponse : posez-nous la question directement.") : ""}</p>
      <div className="ip-faq">
        {shown.map(([question, answer], index) => (
          <details key={question} style={{ "--i": index } as React.CSSProperties}>
            <summary><span className="ip-faq-num" aria-hidden="true">{String(questions.findIndex(([item]) => item === question) + 1).padStart(2, "0")}</span><span>{question}</span><span className="ip-faq-icon" aria-hidden="true" /></summary>
            <div className="ip-faq-answer"><p>{answer}</p></div>
          </details>
        ))}
      </div>
    </div>
  );
}
