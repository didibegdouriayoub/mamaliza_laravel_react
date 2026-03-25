import { apiClient } from '../lib/apiClient';
import { InventoryItem } from '../models/types';

export const inventoryService = {
  getAll: () => apiClient.get('/inventory'),
  getById: (id: string | number) => apiClient.get(`/inventory/${id}`),
  create: (item: Partial<InventoryItem>) => apiClient.post('/inventory', item),
  update: (id: string | number, item: Partial<InventoryItem>) => apiClient.put(`/inventory/${id}`, item),
  delete: (id: string | number) => apiClient.delete(`/inventory/${id}`),
};
