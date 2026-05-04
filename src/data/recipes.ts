export interface ProductRecipe {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  materials: string[];
  available: boolean;
  generatorRoute?: string;
}

export const productRecipes: ProductRecipe[] = [
  {
    id: 'ceramic-vessel',
    title: 'Ceramic Vessel',
    subtitle: 'Procedural lathe design with texture patterns — porcelain & stoneware',
    tags: ['Ceramic', 'Procedural', 'Lathe'],
    materials: ['porcelain', 'stoneware', 'terracotta', 'raku'],
    available: true,
    generatorRoute: '/vessel-generator',
  },
];
