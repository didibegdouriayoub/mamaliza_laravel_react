import { apiClient } from '../lib/apiClient';
import type { StorageLocation } from './storageLocationService';

export type MovementReason = 'Packaging' | 'Production' | 'QC' | 'Return';

export interface StorageMovement {
  id: number;
  productId: number;
  fromLocationId: number | null;
  toLocationId: number | null;
  quantity: number;
  reason: MovementReason;
  operatorId: number;
  fromLocation?: StorageLocation;
  toLocation?: StorageLocation;
  operatorName?: string;
  productName?: string;
  createdAt: string;
}

const toPayload = (m: Partial<StorageMovement>) => ({
  product_id:        m.productId,
  from_location_id:  m.fromLocationId ?? null,
  to_location_id:    m.toLocationId ?? null,
  quantity:          m.quantity,
  reason:            m.reason,
  operator_id:       m.operatorId,
});

const locFromApi = (r: any): StorageLocation => ({
  id: r.id, name: r.name, type: r.type,
  temperatureRequired: r.temperature_required ?? null,
  capacity: r.capacity ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const fromApi = (r: any): StorageMovement => ({
  id:              r.id,
  productId:       r.product_id,
  fromLocationId:  r.from_location_id ?? null,
  toLocationId:    r.to_location_id ?? null,
  quantity:        r.quantity,
  reason:          r.reason,
  operatorId:      r.operator_id,
  fromLocation:    r.from_location ? locFromApi(r.from_location) : undefined,
  toLocation:      r.to_location ? locFromApi(r.to_location) : undefined,
  operatorName:    r.operator?.name ?? null,
  productName:     r.product?.name ?? null,
  createdAt:       r.created_at,
});

export const storageMovementService = {
  getAll: async (): Promise<StorageMovement[]> => {
    const data = await apiClient.get('/storage/movements');
    return (data || []).map(fromApi);
  },
  create: async (m: Partial<StorageMovement>): Promise<StorageMovement> => {
    const data = await apiClient.post('/storage/movements', toPayload(m));
    return fromApi(data);
  },
};
