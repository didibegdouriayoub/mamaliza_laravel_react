import { apiClient } from '../lib/apiClient';

export const productionLogService = {
  getAll: () => apiClient.get('/production-logs'),
  getById: (id: string | number) => apiClient.get(`/production-logs/${id}`),
  create: (log: any) => apiClient.post('/production-logs', log),
  update: (id: string | number, log: any) => apiClient.put(`/production-logs/${id}`, log),
  delete: (id: string | number) => apiClient.delete(`/production-logs/${id}`),
};
