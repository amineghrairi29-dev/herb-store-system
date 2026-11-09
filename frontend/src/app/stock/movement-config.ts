export type MovementType = "ENTRY" | "EXIT" | "LOSS" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "RETURN_IN";

export interface MovementConfig {
  type: MovementType;
  title: string;
  submitLabel: string;
  showCurrentStock: boolean;
  helperText: string;
  actionLabel: string;
  route: string;
}

export const movementConfigs: Record<MovementType, MovementConfig> = {
  ENTRY: { type: "ENTRY", title: "Nouvelle entrée de stock", submitLabel: "Enregistrer l’entrée", showCurrentStock: false, helperText: "Enregistrer une quantité reçue dans le stock.", actionLabel: "Nouvelle entrée", route: "/stock/new-entry" },
  EXIT: { type: "EXIT", title: "Nouvelle sortie de stock", submitLabel: "Enregistrer la sortie", showCurrentStock: true, helperText: "Enregistrer une sortie manuelle de stock.", actionLabel: "Nouvelle sortie", route: "/stock/new-exit" },
  LOSS: { type: "LOSS", title: "Perte de stock", submitLabel: "Enregistrer la perte", showCurrentStock: true, helperText: "Enregistrer une perte de stock : produit endommagé, périmé, manquant ou inutilisable.", actionLabel: "Perte", route: "/stock/new-loss" },
  ADJUSTMENT_IN: { type: "ADJUSTMENT_IN", title: "Ajustement de stock à la hausse", submitLabel: "Enregistrer l’ajustement +", showCurrentStock: false, helperText: "Corriger le stock à la hausse. Saisissez la quantité à ajouter après votre inventaire physique.", actionLabel: "Ajustement +", route: "/stock/new-adjustment-in" },
  ADJUSTMENT_OUT: { type: "ADJUSTMENT_OUT", title: "Ajustement de stock à la baisse", submitLabel: "Enregistrer l’ajustement -", showCurrentStock: true, helperText: "Corriger le stock à la baisse. Saisissez la quantité à retirer après votre inventaire physique.", actionLabel: "Ajustement -", route: "/stock/new-adjustment-out" },
  RETURN_IN: { type: "RETURN_IN", title: "Retour en stock", submitLabel: "Enregistrer le retour", showCurrentStock: false, helperText: "Réintégrer un produit dans le stock.", actionLabel: "Retour", route: "/stock/new-return" },
};

export function isNegativeMovement(type: MovementType): boolean {
  return type === "EXIT" || type === "LOSS" || type === "ADJUSTMENT_OUT";
}
