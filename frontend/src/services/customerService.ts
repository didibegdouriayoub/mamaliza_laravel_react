import { apiClient } from '../lib/apiClient';

export const customerService = {
  getAll: () => apiClient.get('/customers'),
  getById: (id: string | number) => apiClient.get(`/customers/${id}`),
  create: (data: any) => apiClient.post('/customers', data),
  update: (id: string | number, data: any) => apiClient.put(`/customers/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/customers/${id}`),
};
