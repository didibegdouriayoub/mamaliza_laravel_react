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
    supplierId: item.supplierId,    // → supplier_id
    minStock: item.minStock,        // → min_stock
  } as Record<string, unknown>);

export const inventoryService = {
  getAll: () => apiClient.get('/inventory'),
  getById: (id: string | number) => apiClient.get(`/inventory/${id}`),
  create: (item: Partial<InventoryItem>) => apiClient.post('/inventory', toPayload(item)),
  update: (id: string | number, item: Partial<InventoryItem>) => apiClient.put(`/inventory/${id}`, toPayload(item)),
  delete: (id: string | number) => apiClient.delete(`/inventory/${id}`),
};
