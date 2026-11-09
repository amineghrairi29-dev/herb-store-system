export interface PublicCategoryDto {
  id: number;
  slug: string;
  nameAr: string;
  nameFr: string;
  imagePath: string | null;
  subcategories: { id: number; slug: string; nameAr: string; nameFr: string }[];
}
