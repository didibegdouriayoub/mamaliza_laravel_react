import { apiClient } from '../lib/apiClient';
import type { PackagingCarton } from '../models/types';

interface CartonPayload {
  name: string;
  product_name: string;
  pieces_per_carton: number;
  materials: { material_id: string | number; amount_per_carton: number }[];
}

const toPayload = (c: Partial<PackagingCarton> & { materials?: { materialId: string | number; amountPerCarton: number }[] }): CartonPayload => ({
  name:               c.name ?? '',
  product_name:       c.productName ?? '',
  pieces_per_carton:  c.piecesPerCarton ?? 1,
  materials: (c.materials ?? []).map(m => ({
    material_id:      m.materialId,
    amount_per_carton: m.amountPerCarton,
  })),
});

export const packagingCartonService = {
  getAll: () => apiClient.get('/packaging/cartons'),
  create: (c: Parameters<typeof toPayload>[0]) => apiClient.post('/packaging/cartons', toPayload(c)),
  update: (id: string | number, c: Parameters<typeof toPayload>[0]) =>
    apiClient.put(`/packaging/cartons/${id}`, toPayload(c)),
  delete: (id: string | number) => apiClient.delete(`/packaging/cartons/${id}`),
};
