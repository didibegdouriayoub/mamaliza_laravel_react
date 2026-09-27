import { apiClient } from '../lib/apiClient';

export interface FinishedProductInput {
  recipe_id: number | string;
  kg_per_piece: number;
  recipe?: { id: number; name: string };
}

export interface FinishedProductMaterial {
  inventory_item_id: number | string;
  qty_per_piece: number;
  inventory_item?: { id: number; name: string; type: string; unit: string };
}

export interface FinishedProductComponent {
  component_id: number | string;
  qty_per_box: number;
  component?: { id: number; name: string; type: string };
}

export interface FinishedProduct {
  id: number;
  name: string;
  type: 'piece' | 'box';
  unit_price: number;
  notes?: string | null;
  inputs: FinishedProductInput[];
  materials: FinishedProductMaterial[];
  components: FinishedProductComponent[];
  stock?: { quantity: number } | null;
  created_at: string;
  updated_at: string;
}

// These endpoints are consumed in snake_case, so skip apiClient's camelCase conversion.
const raw = { raw: true };

export const finishedProductService = {
  getAll: (): Promise<FinishedProduct[]> =>
    apiClient.fetch('/finished-products', { method: 'GET' }, raw),

  create: (data: Omit<FinishedProduct, 'id' | 'stock' | 'created_at' | 'updated_at'>): Promise<FinishedProduct> =>
    apiClient.fetch('/finished-products', { method: 'POST', body: JSON.stringify(data) }, raw),

  update: (id: number, data: Partial<Omit<FinishedProduct, 'id' | 'stock' | 'created_at' | 'updated_at'>>): Promise<FinishedProduct> =>
    apiClient.fetch(`/finished-products/${id}`, { method: 'PUT', body: JSON.stringify(data) }, raw),

  delete: (id: number): Promise<void> =>
    apiClient.fetch(`/finished-products/${id}`, { method: 'DELETE' }, raw).then(() => undefined),
};
