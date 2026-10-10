import { apiClient } from '../lib/apiClient';

export interface LotTraceIngredient { name: string; quantity: number | null; unit: string | null; lot: string | null; }

export interface LotTraceBatch {
  id: number;
  lot: string | null;
  status: string;
  started_at: string | null;
  output: string | number | null;
  output_unit: string | null;
  ingredients: LotTraceIngredient[];
}

export interface LotTraceSource {
  batch_group_id: number;
  recipe: string | null;
  date: string | null;
  kg_used: number;
  share_percent: number | null;
  batches: LotTraceBatch[];
}

export interface LotTraceRun {
  id: number;
  date: string;
  product: string | null;
  pieces: number;
  operator: string | null;
  sources: LotTraceSource[];
}

export interface LotTraceBuyer {
  order_id: number;
  date: string | null;
  customer: string;
  phone: string | null;
  items: { product: string; quantity: number }[];
}

export interface LotTrace {
  lot_code: string;
  production_date: string;
  products: string[];
  runs: LotTraceRun[];
  buyers: LotTraceBuyer[];
  traceable: boolean;
}

// snake_case payload: skip apiClient's camelCase conversion
const raw = { raw: true };

export const lotTraceService = {
  get: (code: string): Promise<LotTrace> =>
    apiClient.fetch(`/lot-trace/${encodeURIComponent(code)}`, { method: 'GET' }, raw),
};
