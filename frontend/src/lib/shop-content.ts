/**
 * Shop facts shown on the storefront pages. Edit here; the store name, phone and address
 * come from Paramètres > Boutique.
 */
export const shopContent = {
  foundedYear: 2006,
  tagline: "Recettes éprouvées depuis 2006",
  openingHours: [{ days: "Tous les jours", hours: "8h30 – 13h00 · 14h30 – 19h30" }],
  /** Same hours as openingHours, for "Ouvert maintenant" (Tunis time, every day). */
  openingSlots: [
    ["08:30", "13:00"],
    ["14:30", "19:30"],
  ],
  /** Shop position (from Google Maps) and a landmark that helps people find the door. */
  location: {
    latitude: 33.93993,
    longitude: 10.06507,
    landmark: "À côté du bureau de poste Ghannouch Centre",
    landmarkAr: "بحذا البوسطة، قنوش المركز",
  },
} as const;

export function yearsOfExperience(now = new Date()): number {
  return now.getFullYear() - shopContent.foundedYear;
}

const { latitude, longitude } = shopContent.location;
/** Google Maps links built from the coordinates (no API key needed). */
export const mapLinks = {
  view: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  embed: `https://www.google.com/maps?q=${latitude},${longitude}&z=17&hl=fr&output=embed`,
};
