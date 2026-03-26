import { apiClient } from '../lib/apiClient';

export const notificationService = {
  getAll: () => apiClient.get('/notifications'),
  markAsRead: async (id: string | number, currentReadBy: (string | number)[], userId: string | number) => {
    const updatedReadBy = [...new Set([...(currentReadBy || []), userId])];
    return apiClient.put(`/notifications/${id}`, { read_by: updatedReadBy });
  },
};
