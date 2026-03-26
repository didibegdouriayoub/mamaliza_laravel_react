import { apiClient } from '../lib/apiClient';

export interface PermissionEntity {
  id: string | number;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const permissionService = {
  getAll: () => apiClient.get('/permissions'),
  getById: (id: string | number) => apiClient.get(`/permissions/${id}`),
  create: (permission: Partial<PermissionEntity>) => apiClient.post('/permissions', permission),
  update: (id: string | number, permission: Partial<PermissionEntity>) => apiClient.put(`/permissions/${id}`, permission),
  delete: (id: string | number) => apiClient.delete(`/permissions/${id}`),
};
