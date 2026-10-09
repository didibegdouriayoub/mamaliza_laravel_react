import { FinishedProduct, fridgeTotal } from '@/services/finishedProductService';

export interface PieceSplit {
  cartons: number; // whole sealed cartons sold as cartons
  loose: number; // pieces sold loose
  opens: number; // sealed cartons that must be opened to cover the loose pieces
}

/**
 * How an order of `qty` pieces is served (same rule as the server):
 * whole sealed cartons first, the rest from loose pieces, a carton is opened only if loose pieces run short.
 */
export function splitPieces(p: FinishedProduct, qty: number): PieceSplit {
  if (!p.carton || p.type === 'box' || p.carton.qty_per_box <= 0) return { cartons: 0, loose: qty, opens: 0 };

  const k = p.carton.qty_per_box;
  const sealed = Math.floor(p.carton.sealed);
  const cartons = Math.min(Math.floor(qty / k), sealed);
  const loose = qty - cartons * k;
  const sealedLeft = sealed - cartons;
  const looseStock = fridgeTotal(p);
  const opens = loose > looseStock && sealedLeft > 0 ? Math.min(Math.ceil((loose - looseStock) / k), sealedLeft) : 0;

  return { cartons, loose, opens };
}

export interface OrderItemPayload {
  product_name: string;
  finished_product_id: number;
  quantity: number;
  unit_price: number;
  total: number;
}

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Order lines to send to the API. A piece line that contains whole cartons becomes
 * "N cartons" (carton price) + "M pieces" (piece price), so the invoice shows both.
 */
export function expandOrderLines(lines: { product: FinishedProduct; quantity: number }[], products: FinishedProduct[]): OrderItemPayload[] {
  const items: OrderItemPayload[] = [];

  for (const { product: p, quantity } of lines) {
    const split = splitPieces(p, quantity);
    const box = split.cartons > 0 ? products.find(b => b.id === p.carton?.box_id) : undefined;
    let loose = split.loose;

    if (split.cartons > 0 && box) {
      items.push({ product_name: box.name, finished_product_id: box.id, quantity: split.cartons, unit_price: box.unit_price, total: money(split.cartons * box.unit_price) });
    } else if (split.cartons > 0) {
      loose += split.cartons * (p.carton?.qty_per_box ?? 0); // carton product not in the list: price everything per piece
    }
    if (loose > 0) {
      items.push({ product_name: p.name, finished_product_id: p.id, quantity: loose, unit_price: p.unit_price, total: money(loose * p.unit_price) });
    }
  }

  return items;
}

/** "4 cartons + 5 pieces" (or null when there are no whole cartons). */
export function splitLabel(split: PieceSplit): string | null {
  if (split.cartons === 0) return null;
  return `${split.cartons} carton${split.cartons === 1 ? '' : 's'}${split.loose > 0 ? ` + ${split.loose} piece${split.loose === 1 ? '' : 's'}` : ''}`;
}
