import { apiClient, getAuthToken } from '../lib/apiClient';

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

export interface FinishedGoodsLot {
  id: number;
  finished_product_id: number;
  lot_date: string;
  qty_produced: number;
  qty_remaining: number;
  is_opening: boolean;
}

export interface FinishedGoodsMovement {
  id: number;
  type: 'production' | 'production_removed' | 'order' | 'return' | 'adjustment';
  quantity: number;
  reason?: string | null;
  created_at: string;
  user?: { id: number; name: string } | null;
  lot?: { id: number; lot_date: string } | null;
}

export interface FinishedStockDetail {
  lots: FinishedGoodsLot[];
  movements: FinishedGoodsMovement[];
}

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/** Full URL for a product photo (image_url is relative to the API base). */
export const productImageSrc = (p: { image_url?: string | null }): string | null =>
  p.image_url ? `${apiBase()}/${p.image_url}` : null;

/** Total sitting in lots (what is physically in the fridge). */
export const fridgeTotal = (p: FinishedProduct): number =>
  (p.available_lots ?? []).reduce((s, l) => s + Number(l.qty_remaining), 0);

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
  image_url?: string | null;
  available_lots?: FinishedGoodsLot[];
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

  getStock: (id: number): Promise<FinishedStockDetail> =>
    apiClient.fetch(`/finished-products/${id}/stock`, { method: 'GET' }, raw),

  adjust: (id: number, data: { direction: 'add' | 'remove'; quantity: number; reason?: string; lot_id?: number | null; lot_date?: string }): Promise<FinishedStockDetail> =>
    apiClient.fetch(`/finished-products/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }, raw),

  deleteImage: (id: number): Promise<FinishedProduct> =>
    apiClient.fetch(`/finished-products/${id}/image`, { method: 'DELETE' }, raw),

  // multipart upload: apiClient forces a JSON Content-Type, so this talks to fetch directly
  uploadImage: async (id: number, file: File): Promise<FinishedProduct> => {
    const body = new FormData();
    body.append('image', file);
    const res = await fetch(`${apiBase()}/finished-products/${id}/image`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Upload failed');
    return json;
  },
};
