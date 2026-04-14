import { apiClient, toSnakeCase } from '../lib/apiClient';
import type { PackagingMaterial } from '../models/types';

const toPayload = (m: Partial<PackagingMaterial>) =>
  toSnakeCase({
    name:           m.name,
    code:           m.code,
    type:           m.type,
    stockQty:       m.stockQty,
    stockUnit:      m.stockUnit,
    lowStockAlert:  m.lowStockAlert ?? null,
    accountCode:    m.accountCode ?? null,
    dimLength:      m.dimLength ?? null,
    dimWidth:       m.dimWidth ?? null,
    dimHeight:      m.dimHeight ?? null,
    notes:          m.notes ?? null,
  } as Record<string, unknown>);

export const packagingMaterialService = {
  getAll: (type?: string) =>
    apiClient.get('/packaging/materials' + (type ? `?type=${encodeURIComponent(type)}` : '')),
  create: (m: Partial<PackagingMaterial>) => apiClient.post('/packaging/materials', toPayload(m)),
  update: (id: string | number, m: Partial<PackagingMaterial>) =>
    apiClient.put(`/packaging/materials/${id}`, toPayload(m)),
  delete: (id: string | number) => apiClient.delete(`/packaging/materials/${id}`),
};
