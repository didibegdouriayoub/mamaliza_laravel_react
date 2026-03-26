export const getAuthToken = () => localStorage.getItem('auth_token');
export const setAuthToken = (token: string) => localStorage.setItem('auth_token', token);
export const removeAuthToken = () => localStorage.removeItem('auth_token');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** snake_case → camelCase (single key) */
const camelize = (s: string) =>
  s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** Deep-convert all object keys from snake_case to camelCase */
export function toCamelCase<T = any>(data: unknown): T {
  if (Array.isArray(data)) return data.map(toCamelCase) as unknown as T;
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [
        camelize(k),
        toCamelCase(v),
      ])
    ) as T;
  }
  return data as T;
}

/** camelCase → snake_case (single key) */
const snakify = (s: string) =>
  s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);

/** Shallow-convert top-level object keys from camelCase to snake_case (for outgoing payloads) */
export function toSnakeCase<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [snakify(k), v])
  ) as T;
}

// ── API Client ────────────────────────────────────────────────────────────────

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
        if (getAuthToken()) {
          removeAuthToken();
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
      }

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errData = await response.json();
          if (errData.message) errorMsg = errData.message;
        } catch (_) { }
        throw new Error(errorMsg || 'API Error');
      }

      if (response.status === 204) return null;

      const json = await response.json();
      return toCamelCase(json);
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
  patch(endpoint: string, body: any, options?: RequestInit) {
    return this.fetch(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  },
  delete(endpoint: string, options?: RequestInit) {
    return this.fetch(endpoint, { ...options, method: 'DELETE' });
  }
};
