/** How a recipe is presented, from its format (BOX, BAG, LIQUID) and packaging text. */
type RecipeLike = { recipeFormat?: "BOX" | "BAG" | "LIQUID" | null; packaging?: string | null; saleUnit: string };

const fallbackUnits: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PIECE: "pièce" };

/** Unit after the price: "boîte", "flacon", "kg" (older products keep their own unit). */
export function priceUnit(product: RecipeLike): string {
  if (product.recipeFormat === "BOX") return "boîte";
  if (product.recipeFormat === "LIQUID") return "flacon";
  if (product.recipeFormat === "BAG") return "kg";
  return fallbackUnits[product.saleUnit] ?? product.saleUnit;
}

/** "Boîte 100 g", "Sachet au poids", "Flacon 250 ml"; null when nothing is known. */
export function formatLabel(product: RecipeLike): string | null {
  if (product.recipeFormat === "BAG") return "Sachet au poids";
  if (product.recipeFormat) return product.packaging || (product.recipeFormat === "BOX" ? "Boîte" : "Flacon");
  return product.packaging || null;
}

/** Ingredients written one per line (commas accepted too), cleaned for display. */
export function ingredientList(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n|[,،;]/)
    .map((item) => item.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 24);
}
