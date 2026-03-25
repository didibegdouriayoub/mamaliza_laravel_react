import { apiClient } from '../lib/apiClient';

export const supplierService = {
  getAll: () => apiClient.get('/suppliers'),
  getById: (id: string | number) => apiClient.get(`/suppliers/${id}`),
  create: (data: any) => apiClient.post('/suppliers', data),
  update: (id: string | number, data: any) => apiClient.put(`/suppliers/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/suppliers/${id}`),
};
