import { apiClient } from '../lib/apiClient';

export const userService = {
  getAll: () => apiClient.get('/users'),
  getById: (id: string | number) => apiClient.get(`/users/${id}`),
  create: (data: any) => apiClient.post('/users', data),
  update: (id: string | number, data: any) => apiClient.put(`/users/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/users/${id}`),
};
