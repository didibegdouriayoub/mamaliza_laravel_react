import { apiClient } from '../lib/apiClient';

export interface StorageLocation {
  id: number;
  name: string;
  type: 'Fridge' | 'Room Temp' | 'Workbench' | 'Other';
  temperatureRequired: string | null;
  capacity: string | null;
  createdAt: string;
  updatedAt: string;
}

const toPayload = (l: Partial<StorageLocation>) => ({
  name:                 l.name,
  type:                 l.type,
  temperature_required: l.temperatureRequired ?? null,
  capacity:             l.capacity ?? null,
});

const fromApi = (r: any): StorageLocation => ({
  id:                   r.id,
  name:                 r.name,
  type:                 r.type,
  temperatureRequired:  r.temperature_required ?? null,
  capacity:             r.capacity ?? null,
  createdAt:            r.created_at,
  updatedAt:            r.updated_at,
});

export const storageLocationService = {
  getAll: async (): Promise<StorageLocation[]> => {
    const data = await apiClient.get('/storage/locations');
    return (data || []).map(fromApi);
  },
  create: async (l: Partial<StorageLocation>): Promise<StorageLocation> => {
    const data = await apiClient.post('/storage/locations', toPayload(l));
    return fromApi(data);
  },
  update: async (id: number, l: Partial<StorageLocation>): Promise<StorageLocation> => {
    const data = await apiClient.patch(`/storage/locations/${id}`, toPayload(l));
    return fromApi(data);
  },
  delete: (id: number) => apiClient.delete(`/storage/locations/${id}`),
};
