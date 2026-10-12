import { Input } from '@/components/ui/input';
import { FinishedGoodsLot } from '@/services/finishedProductService';

interface Props {
  lots: FinishedGoodsLot[];
  picks: Record<number, number>; // lot id -> quantity taken
  onChange: (lotId: number, qty: number) => void;
}

/** How many to take from each lot of a product (lots are listed oldest first). */
export function LotPicker({ lots, picks, onChange }: Props) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">How many to take from each lot:</p>
      {lots.length === 0
        ? <p className="text-xs text-destructive">No lots in stock for this product.</p>
        : lots.map(lot => {
          const left = Number(lot.qty_remaining);
          return (
            <div key={lot.id} className="flex items-center justify-between gap-3 py-1 text-sm">
              <span>{lot.lot_code || '—'} <span className="text-muted-foreground">· {lot.lot_date} · {left} left</span></span>
              <Input type="number" min="0" max={left} className="h-7 w-24" placeholder="0"
                value={picks[lot.id] || ''} onChange={e => onChange(lot.id, Math.min(left, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
          );
        })}
    </div>
  );
}
