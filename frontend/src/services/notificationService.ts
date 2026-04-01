import { apiClient } from '../lib/apiClient';

export const notificationService = {
  getAll: () => apiClient.get('/notifications'),
  // T12.9.1: use PATCH /notifications/{id}/read — server appends the auth user automatically
  markAsRead: (id: string | number) => apiClient.patch(`/notifications/${id}/read`, {}),
};
