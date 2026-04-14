import { apiClient, toSnakeCase } from '../lib/apiClient';
import { InventoryItem } from '../models/types';

/** Map a camelCase inventory payload to what Laravel expects (snake_case) */
const toPayload = (item: Partial<InventoryItem>) =>
  toSnakeCase({
    name: item.name,
    type: item.type,
    quantity: item.quantity,
    unit: item.unit,
    price: item.price,
    supplierId: item.supplierId || null,  // → supplier_id (null if empty)
    lot: item.lot || null,
    code: item.code || null,
    minStock: item.minStock,              // → min_stock
    leadTimeDays: item.leadTimeDays ?? null, // → lead_time_days
    createdAt: item.createdAt || null,    // → created_at
  } as Record<string, unknown>);

export const inventoryService = {
  getAll: () => apiClient.get('/inventory'),
  getById: (id: string | number) => apiClient.get(`/inventory/${id}`),
  getAllHistory: () => apiClient.get('/inventory/history/all'),
  create: (item: Partial<InventoryItem>) => apiClient.post('/inventory', toPayload(item)),
  update: (id: string | number, item: Partial<InventoryItem>) => apiClient.put(`/inventory/${id}`, toPayload(item)),
  delete: (id: string | number) => apiClient.delete(`/inventory/${id}`),
};
