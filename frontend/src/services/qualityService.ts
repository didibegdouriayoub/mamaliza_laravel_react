import { apiClient } from '../lib/apiClient';

export const qualityService = {
  getAll: () => apiClient.get('/quality-controls'),
  getById: (id: string | number) => apiClient.get(`/quality-controls/${id}`),
  create: (evalData: any) => apiClient.post('/quality-controls', evalData),
  update: (id: string | number, evalData: any) => apiClient.put(`/quality-controls/${id}`, evalData),
  delete: (id: string | number) => apiClient.delete(`/quality-controls/${id}`),
};
