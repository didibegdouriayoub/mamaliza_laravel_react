import { apiClient } from '../lib/apiClient';

export interface FinishingLogBatchSource {
  batch_group_id: number | string;
  kg_used: number;
}

export interface FinishingLog {
  id: number;
  finished_product_id: number;
  pieces_produced: number;
  date: string;
  notes?: string | null;
  operator_id?: number | null;
  product?: { id: number; name: string; type: string; unit_price: number };
  batch_sources?: { batch_group_id: number; kg_used: number; batch_group?: { id: number; recipe?: { name: string } } }[];
  operator?: { id: number; name: string };
  created_at: string;
}

export const finishingLogService = {
  getAll: (): Promise<FinishingLog[]> =>
    apiClient('/finishing-logs').then(r => r.json()),

  create: (data: {
    finished_product_id: number;
    pieces_produced: number;
    date: string;
    notes?: string;
    batch_sources: FinishingLogBatchSource[];
  }): Promise<void> =>
    apiClient('/finishing-logs', { method: 'POST', body: JSON.stringify(data) }).then(() => undefined),

  delete: (id: number): Promise<void> =>
    apiClient(`/finishing-logs/${id}`, { method: 'DELETE' }).then(() => undefined),
};
