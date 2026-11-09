export class PurchaseLineInput {
  productId: number;
  quantity: string;
  unit: string;
  unitPurchasePrice: string;
}
export class CreatePurchaseDto {
  reference: string;
  supplierId: number;
  purchaseDate: string;
  notes?: string | null;
  lines: PurchaseLineInput[];
}
export type UpdatePurchaseDto = Partial<CreatePurchaseDto>;
