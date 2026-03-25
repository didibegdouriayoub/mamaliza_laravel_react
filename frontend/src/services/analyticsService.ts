import { apiClient } from '../lib/apiClient';

export const analyticsService = {
  getDashboard: () => apiClient.get('/analytics/dashboard'),
};
