export const getAuthToken = () => localStorage.getItem('auth_token');
export const setAuthToken = (token: string) => localStorage.setItem('auth_token', token);
export const removeAuthToken = () => localStorage.removeItem('auth_token');

export const apiClient = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const token = getAuthToken();
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        removeAuthToken();
        window.dispatchEvent(new Event('auth:unauthorized'));
      }

      if (!response.ok) {
         let errorMsg = response.statusText;
         try {
           const errData = await response.json();
           if (errData.message) errorMsg = errData.message;
         } catch(e) {}
         throw new Error(errorMsg || 'API Error');
      }

      if (response.status === 204) return null;

      return response.json();
    } catch (error) {
      throw error;
    }
  },

  get(endpoint: string, options?: RequestInit) {
    return this.fetch(endpoint, { ...options, method: 'GET' });
  },
  post(endpoint: string, body: any, options?: RequestInit) {
    return this.fetch(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
  },
  put(endpoint: string, body: any, options?: RequestInit) {
    return this.fetch(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
  },
  delete(endpoint: string, options?: RequestInit) {
    return this.fetch(endpoint, { ...options, method: 'DELETE' });
  }
};
