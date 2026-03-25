import { apiClient } from '../lib/apiClient';
import { Order } from '../models/types';

export const orderService = {
  getAll: () => apiClient.get('/orders'),
  getById: (id: string | number) => apiClient.get(`/orders/${id}`),
  create: (order: Partial<Order>) => apiClient.post('/orders', order),
  update: (id: string | number, order: Partial<Order>) => apiClient.put(`/orders/${id}`, order),
  delete: (id: string | number) => apiClient.delete(`/orders/${id}`),
};
