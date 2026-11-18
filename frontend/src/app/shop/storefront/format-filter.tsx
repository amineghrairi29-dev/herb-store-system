import type { RecipeFormat } from "@/lib/recipe";
import "./format-filter.css";

const choices: { value: "" | RecipeFormat; label: string; ar: string }[] = [
  { value: "", label: "Tout", ar: "الكل" },
  { value: "BOX", label: "Boîte", ar: "علبة" },
  { value: "BAG", label: "Sachet", ar: "كيس" },
  { value: "LIQUID", label: "Flacon", ar: "قارورة" },
];

/** Small drawings of each format, in the stroke style of the shop icons. */
function FormatIcon({ format }: { format: "" | RecipeFormat }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ff-icon">
      {format === "BOX" ? (
        <>
          <rect x="4" y="9" width="16" height="11" rx="2" {...common} />
          <path d="M3 6.5h18v2.5H3z" {...common} />
          <path d="M9 13h6" {...common} strokeLinecap="round" />
        </>
      ) : format === "BAG" ? (
        <>
          <path d="M6 8h12l1 12H5z" {...common} />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" {...common} />
          <path d="M8 4.5c1 .8 1 1.7 0 2.5" {...common} strokeLinecap="round" />
        </>
      ) : format === "LIQUID" ? (
        <>
          <path d="M10 3h4v4l2.5 3v9a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-9L10 7z" {...common} />
          <path d="M7.5 14c1.5-1 3-1 4.5 0s3 1 4.5 0" {...common} strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="3" {...common} />
          <circle cx="16" cy="8" r="3" {...common} />
          <circle cx="8" cy="16" r="3" {...common} />
          <circle cx="16" cy="16" r="3" {...common} />
        </>
      )}
    </svg>
  );
}

/** "Tout · Boîte · Sachet · Flacon": narrows a list of recipes to one format. */
export default function FormatFilter({
  value,
  onChange,
  disabled,
}: {
  value: "" | RecipeFormat;
  onChange: (format: "" | RecipeFormat) => void;
  disabled?: boolean;
}) {
  return (
    <div className="ff" role="group" aria-label="Format de la recette">
      {choices.map((choice) => (
        <button
          key={choice.value || "all"}
          type="button"
          className="ff-chip"
          aria-pressed={value === choice.value}
          disabled={disabled}
          onClick={() => onChange(choice.value)}
        >
          <FormatIcon format={choice.value} />
          <span>{choice.label}</span>
          <span className="ff-ar" lang="ar" aria-hidden="true">
            {choice.ar}
          </span>
        </button>
      ))}
    </div>
  );
}
