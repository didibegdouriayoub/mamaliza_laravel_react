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

export const finishedProductService = {
  getAll: (): Promise<FinishedProduct[]> =>
    apiClient('/finished-products').then(r => r.json()),

  create: (data: Omit<FinishedProduct, 'id' | 'stock' | 'created_at' | 'updated_at'>): Promise<FinishedProduct> =>
    apiClient('/finished-products', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),

  update: (id: number, data: Partial<Omit<FinishedProduct, 'id' | 'stock' | 'created_at' | 'updated_at'>>): Promise<FinishedProduct> =>
    apiClient(`/finished-products/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.json()),

  delete: (id: number): Promise<void> =>
    apiClient(`/finished-products/${id}`, { method: 'DELETE' }).then(() => undefined),
};
