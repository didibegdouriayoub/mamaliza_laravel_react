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
  lot_code?: string | null;
  operator_id?: number | null;
  product?: { id: number; name: string; type: string; unit_price: number };
  batch_sources?: { batch_group_id: number; kg_used: number; batch_group?: { id: number; recipe?: { name: string } } }[];
  operator?: { id: number; name: string };
  created_at: string;
}

// These endpoints are consumed in snake_case, so skip apiClient's camelCase conversion.
const raw = { raw: true };

export const finishingLogService = {
  getAll: (): Promise<FinishingLog[]> =>
    apiClient.fetch('/finishing-logs', { method: 'GET' }, raw),

  create: (data: {
    finished_product_id: number;
    pieces_produced: number;
    cartons?: number; // piece products: cartons to pack (default: the maximum)
    date: string;
    notes?: string;
    lot_code?: string; // printed box code (piece products)
    batch_sources: FinishingLogBatchSource[];
  }): Promise<void> =>
    apiClient.fetch('/finishing-logs', { method: 'POST', body: JSON.stringify(data) }, raw).then(() => undefined),

  delete: (id: number): Promise<void> =>
    apiClient.fetch(`/finishing-logs/${id}`, { method: 'DELETE' }, raw).then(() => undefined),
};
