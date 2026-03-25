import { apiClient } from '../lib/apiClient';

export const batchService = {
  getAll: () => apiClient.get('/batches'),
  getById: (id: string | number) => apiClient.get(`/batches/${id}`),
  create: (batch: any) => apiClient.post('/batches', batch),
  update: (id: string | number, batch: any) => apiClient.put(`/batches/${id}`, batch),
  delete: (id: string | number) => apiClient.delete(`/batches/${id}`),
  addNote: (id: string | number, note: any) => apiClient.post(`/batches/${id}/notes`, note),
};
