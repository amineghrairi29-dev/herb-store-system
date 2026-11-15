/**
 * Shop facts shown on the storefront pages. Edit here; the store name, phone and address
 * come from Paramètres > Boutique.
 */
export const shopContent = {
  foundedYear: 2006,
  tagline: "Recettes éprouvées depuis 2006",
  openingHours: [
    { days: "Tous les jours", hours: "8h30 – 13h00 · 14h30 – 19h30" },
  ],
} as const;

export function yearsOfExperience(now = new Date()): number {
  return now.getFullYear() - shopContent.foundedYear;
}
