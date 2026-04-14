import { apiClient } from '../lib/apiClient';
import type { PackagingLog } from '../models/types';

const toPayload = (l: Partial<PackagingLog>) => ({
  carton_id:     l.cartonId,
  date:          l.date,
  cartons_count: l.cartonsCount,
  loose_pieces:  l.loosePieces,
  notes:         l.notes ?? null,
});

export const packagingLogService = {
  getAll: () => apiClient.get('/packaging/logs'),
  create: (l: Partial<PackagingLog>) => apiClient.post('/packaging/logs', toPayload(l)),
  delete: (id: string | number) => apiClient.delete(`/packaging/logs/${id}`),
};
