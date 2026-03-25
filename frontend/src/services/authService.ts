import { apiClient } from '../lib/apiClient';

export const authService = {
  login: async (email: string, password: string) => {
    return apiClient.post('/auth/login', { email, password });
  },
  logout: async () => {
    return apiClient.post('/auth/logout', {});
  },
  getMe: async () => {
    return apiClient.get('/auth/me');
  }
};
