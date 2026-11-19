import "./storefront/state-page.css";

const leaf = "M5 19C5 10 11 4 20 4c0 9-6 15-15 15z";

/** Shown while a shop page loads; appears only after a short delay so quick loads don't flash. */
export default function Loading() {
  return (
    <div className="sp-loading" role="status">
      <div className="sp-loading-leaves" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <svg key={index} viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <path d={leaf} />
          </svg>
        ))}
      </div>
      <p>Un instant…</p>
    </div>
  );
}
