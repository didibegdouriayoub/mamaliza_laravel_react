import { apiClient } from '../lib/apiClient';

export interface TourneeItem {
  id: number;
  finished_product_id: number;
  product_name: string | null;
  lot_id: number | null;
  lot_code: string | null;
  lot_date: string | null;
  qty_loaded: number;
  qty_delivered: number;
  qty_returned: number;
  qty_lost: number;
  qty_remaining: number;
}

export interface TourneeOrder {
  id: number;
  doc_number: string | null;
  customer_id?: number | null;
  customer_name: string;
  total_amount?: number;
  status: string;
  items: { product_name: string; quantity: number }[];
}

export interface Tournee {
  id: number;
  worker_name: string;
  date: string;
  status: 'open' | 'closed';
  notes?: string | null;
  items: TourneeItem[];
  orders: TourneeOrder[];
}

export interface SettleLine { finished_product_id: number; quantity: number; unit_price?: number }

// snake_case endpoints: skip apiClient's camelCase conversion
const raw = { raw: true };

export const tourneeService = {
  getAll: (): Promise<Tournee[]> => apiClient.fetch('/tournees', { method: 'GET' }, raw),

  create: (data: { worker_name: string; date: string; notes?: string; items: { lot_id: number; qty: number }[] }): Promise<Tournee> =>
    apiClient.fetch('/tournees', { method: 'POST', body: JSON.stringify(data) }, raw),

  settle: (id: number, data: { customer_id?: number | string; customer_name: string; paid_in_full?: boolean; items: SettleLine[] }) =>
    apiClient.fetch(`/tournees/${id}/settle`, { method: 'POST', body: JSON.stringify(data) }, raw),

  close: (id: number, returns?: { item_id: number; qty: number }[]): Promise<Tournee> =>
    apiClient.fetch(`/tournees/${id}/close`, { method: 'POST', body: JSON.stringify({ returns }) }, raw),

  cancel: (id: number): Promise<void> =>
    apiClient.fetch(`/tournees/${id}`, { method: 'DELETE' }, raw).then(() => undefined),
};

/** What is still with the worker, per product (summed over lots). */
export const remainingByProduct = (t: Tournee): { finished_product_id: number; name: string; remaining: number }[] => {
  const map = new Map<number, { finished_product_id: number; name: string; remaining: number }>();
  for (const i of t.items) {
    const row = map.get(i.finished_product_id) ?? { finished_product_id: i.finished_product_id, name: i.product_name ?? `#${i.finished_product_id}`, remaining: 0 };
    row.remaining += i.qty_remaining;
    map.set(i.finished_product_id, row);
  }
  return [...map.values()];
};
