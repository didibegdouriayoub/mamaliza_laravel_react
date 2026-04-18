import { apiClient } from '../lib/apiClient';

export const notificationService = {
  getAll: () => apiClient.get('/notifications'),
  markAsRead: (id: string | number) => apiClient.patch(`/notifications/${id}/read`, {}),
  deleteOne: (id: string | number) => apiClient.delete(`/notifications/${id}`),
  deleteAll: () => apiClient.delete('/notifications'),
};
