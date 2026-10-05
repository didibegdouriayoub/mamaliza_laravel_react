import { apiClient } from '../lib/apiClient';
import { Recipe, RecipeIngredient } from '../models/types';

/** Convert a camelCase ingredient to snake_case for the backend */
const ingToPayload = (i: RecipeIngredient) => ({
  material_id: i.materialId,
  material_name: i.materialName,
  quantity: i.quantity,
  unit: i.unit,
  unit_price: i.unitPrice,
});

/** Convert a camelCase recipe payload to what Laravel expects */
const toPayload = (r: Partial<Recipe>) => ({
  name: r.name,
  description: r.description,
  steps: r.steps,
  target_weight: r.targetWeight,
  piece_weight: r.pieceWeight,
  recipe_status: r.recipeStatus,
  packages: r.packages,
  version: r.version,
  ingredients: r.ingredients?.map(ingToPayload),
});

export const recipeService = {
  getAll: () => apiClient.get('/recipes'),
  getById: (id: string | number) => apiClient.get(`/recipes/${id}`),
  create: (recipe: Partial<Recipe>) => apiClient.post('/recipes', toPayload(recipe)),
  update: (id: string | number, recipe: Partial<Recipe>) => apiClient.put(`/recipes/${id}`, toPayload(recipe)),
  delete: (id: string | number) => apiClient.delete(`/recipes/${id}`),
  // Admin: swap one inventory item for another (same code + unit) in the given recipes
  replaceIngredient: (fromMaterialId: string | number, toMaterialId: string | number, recipeIds: (string | number)[]) =>
    apiClient.post('/recipes/replace-ingredient', {
      from_material_id: Number(fromMaterialId),
      to_material_id: Number(toMaterialId),
      recipe_ids: recipeIds.map(Number),
    }),
};
