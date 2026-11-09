export class SaleLineInput {
  productId: number;
  quantity: string;
  unit: string;
  unitSalePrice: string;
}
export class CreateSaleDto {
  reference: string;
  saleDate: string;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  lines: SaleLineInput[];
}
export type UpdateSaleDto = Partial<CreateSaleDto>;
