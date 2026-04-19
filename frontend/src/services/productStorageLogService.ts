import { apiClient } from '../lib/apiClient';
import type { StorageLocation } from './storageLocationService';

export interface ProductStorageLog {
  id: number;
  productId: number;
  batchId: number | null;
  locationId: number;
  quantity: number;
  entryDate: string;
  status: 'In Storage' | 'In Use' | 'Out';
  location?: StorageLocation;
  productName?: string;
  createdAt: string;
  updatedAt: string;
}

const toPayload = (l: Partial<ProductStorageLog>) => ({
  product_id:   l.productId,
  batch_id:     l.batchId ?? null,
  location_id:  l.locationId,
  quantity:     l.quantity,
  entry_date:   l.entryDate,
  status:       l.status,
});

const fromApi = (r: any): ProductStorageLog => ({
  id:          r.id,
  productId:   r.product_id,
  batchId:     r.batch_id ?? null,
  locationId:  r.location_id,
  quantity:    r.quantity,
  entryDate:   r.entry_date,
  status:      r.status,
  location:    r.location ? {
    id: r.location.id, name: r.location.name, type: r.location.type,
    temperatureRequired: r.location.temperature_required ?? null,
    capacity: r.location.capacity ?? null,
    createdAt: r.location.created_at, updatedAt: r.location.updated_at,
  } : undefined,
  productName: r.product?.name ?? null,
  createdAt:   r.created_at,
  updatedAt:   r.updated_at,
});

export const productStorageLogService = {
  getAll: async (): Promise<ProductStorageLog[]> => {
    const data = await apiClient.get('/storage/logs');
    return (data || []).map(fromApi);
  },
  create: async (l: Partial<ProductStorageLog>): Promise<ProductStorageLog> => {
    const data = await apiClient.post('/storage/logs', toPayload(l));
    return fromApi(data);
  },
  update: async (id: number, l: Partial<ProductStorageLog>): Promise<ProductStorageLog> => {
    const data = await apiClient.patch(`/storage/logs/${id}`, toPayload(l));
    return fromApi(data);
  },
  delete: (id: number) => apiClient.delete(`/storage/logs/${id}`),
};
