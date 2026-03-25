import { apiClient } from '../lib/apiClient';

export const notificationService = {
  getAll: () => apiClient.get('/notifications'),
  markAsRead: (id: string | number) => apiClient.put(`/notifications/${id}`, { read_by: [/* handle user append logic here/backend */] }),
};
