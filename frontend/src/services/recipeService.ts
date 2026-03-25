import { apiClient } from '../lib/apiClient';
import { Recipe } from '../models/types';

export const recipeService = {
  getAll: () => apiClient.get('/recipes'),
  getById: (id: string | number) => apiClient.get(`/recipes/${id}`),
  create: (recipe: Partial<Recipe>) => apiClient.post('/recipes', recipe),
  update: (id: string | number, recipe: Partial<Recipe>) => apiClient.put(`/recipes/${id}`, recipe),
  delete: (id: string | number) => apiClient.delete(`/recipes/${id}`),
};
