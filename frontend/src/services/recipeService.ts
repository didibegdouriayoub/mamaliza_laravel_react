import { Recipe } from '@/models/types';
import { mockRecipes } from '@/data/mockData';

let recipes = [...mockRecipes];
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export const recipeService = {
  async getAll(): Promise<Recipe[]> { await delay(); return [...recipes]; },
  async getById(id: string): Promise<Recipe | undefined> { await delay(); return recipes.find(r => r.id === id); },
  async create(recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Recipe> {
    await delay();
    const newRecipe: Recipe = { ...recipe, id: `r${Date.now()}`, version: 1, createdAt: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString().split('T')[0] };
    recipes.push(newRecipe);
    return newRecipe;
  },
  async update(id: string, updates: Partial<Recipe>): Promise<Recipe> {
    await delay();
    const idx = recipes.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Recipe not found');
    recipes[idx] = { ...recipes[idx], ...updates, version: recipes[idx].version + 1, updatedAt: new Date().toISOString().split('T')[0] };
    return recipes[idx];
  },
  async delete(id: string): Promise<void> { await delay(); recipes = recipes.filter(r => r.id !== id); },
};
