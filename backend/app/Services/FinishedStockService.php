<?php

namespace App\Services;

use App\Models\FinishedGoodsLot;
use App\Models\FinishedGoodsMovement;
use App\Models\FinishedGoodsStock;
use App\Models\FinishedProduct;
use App\Models\FinishedProductComponent;
use Illuminate\Validation\ValidationException;

/**
 * Finished-goods stock by lot (production date). Callers wrap these in a DB transaction.
 * finished_goods_stock.quantity stays the product total; every change also writes a movement.
 */
class FinishedStockService
{
    /** Add a new lot to the fridge. */
    public function receive(
        int $productId,
        float $qty,
        string $date,
        string $type = 'production',
        ?int $finishingLogId = null,
        ?string $reason = null,
        ?int $orderId = null,
        ?int $orderItemId = null,
        bool $isOpening = false,
        ?string $lotCode = null,
    ): FinishedGoodsLot {
        $lot = FinishedGoodsLot::create([
            'finished_product_id' => $productId,
            'finishing_log_id'    => $finishingLogId,
            'lot_date'            => $date,
            'lot_code'            => $lotCode,
            'qty_produced'        => $qty,
            'qty_remaining'       => $qty,
            'is_opening'          => $isOpening,
        ]);

        $this->adjustTotal($productId, $qty);
        $this->log($productId, $lot->id, $type, $qty, $reason, $orderId, $orderItemId, $finishingLogId);

        return $lot;
    }

    /**
     * Take $qty out of the fridge, oldest lot first (or from $lotId when given).
     * The total drops by the full $qty when $allowOversell, otherwise only by what lots could cover.
     * Returns the quantity actually taken from lots; the difference is the shortfall.
     */
    public function deduct(
        int $productId,
        float $qty,
        string $type,
        ?string $reason = null,
        ?int $lotId = null,
        ?int $orderId = null,
        ?int $orderItemId = null,
        bool $allowOversell = false,
        ?int $finishingLogId = null,
    ): float {
        $taken = array_sum(array_column(
            $this->takeFromLots($productId, $qty, $type, $reason, $lotId, $orderId, $orderItemId, $finishingLogId),
            'qty'
        ));

        $this->adjustTotal($productId, -($allowOversell ? $qty : $taken));

        return $taken;
    }

    /**
     * Lowers the lots only (not the product total). Returns [['lot' => FinishedGoodsLot, 'qty' => taken], ...] oldest first.
     */
    private function takeFromLots(
        int $productId, float $qty, string $type, ?string $reason = null, ?int $lotId = null,
        ?int $orderId = null, ?int $orderItemId = null, ?int $finishingLogId = null,
    ): array {
        $lots = FinishedGoodsLot::where('finished_product_id', $productId)
            ->where('qty_remaining', '>', 0)
            ->when($lotId, fn ($q) => $q->where('id', $lotId))
            ->orderBy('lot_date')->orderBy('id')
            ->lockForUpdate()->get();

        $left = $qty;
        $taken = [];
        foreach ($lots as $lot) {
            if ($left <= 0) {
                break;
            }
            $take = min($lot->qty_remaining, $left);
            $lot->qty_remaining = $lot->qty_remaining - $take;
            $lot->save();
            $this->log($productId, $lot->id, $type, -$take, $reason, $orderId, $orderItemId, $finishingLogId);
            $left -= $take;
            $taken[] = ['lot' => $lot, 'qty' => $take];
        }

        return $taken;
    }

    // ── Cartons ──────────────────────────────────────────────────────────────

    /** The carton (box product) a piece product is packed into, or null. */
    public function cartonOf(int $productId): ?FinishedProductComponent
    {
        return FinishedProductComponent::where('component_id', $productId)->orderBy('id')->first();
    }

    /**
     * Pack $cartons of a box product: uses its component pieces (oldest lots first) and adds sealed-carton lots.
     * Each carton takes the date of the oldest piece inside it. Packaging items are handled by the caller.
     * Returns the number of cartons packed per lot date.
     */
    public function pack(FinishedProduct $box, int $cartons, int $finishingLogId): void
    {
        $components = $box->components()->with('component:id,name')->get();
        if ($components->isEmpty()) {
            throw ValidationException::withMessages(['finished_product_id' => "\"{$box->name}\" has no contents defined, so it cannot be packed."]);
        }

        // enough pieces for every component?
        foreach ($components as $c) {
            $need = $c->qty_per_box * $cartons;
            $have = $this->available($c->component_id);
            if ($need > $have) {
                throw ValidationException::withMessages(['pieces_produced' => "Not enough \"{$c->component->name}\": {$cartons} carton(s) need {$need} pieces, only {$have} in stock."]);
            }
        }

        // oldest piece date per carton, across components
        $cartonDates = array_fill(0, $cartons, null);
        $cartonCodes = array_fill(0, $cartons, null); // lot code of those oldest pieces
        foreach ($components as $c) {
            $lots = FinishedGoodsLot::where('finished_product_id', $c->component_id)
                ->where('qty_remaining', '>', 0)->orderBy('lot_date')->orderBy('id')->get();
            $k = $c->qty_per_box;
            for ($j = 0; $j < $cartons; $j++) {
                $startIndex = $j * $k; // first piece of carton j in FIFO order
                $acc = 0.0;
                foreach ($lots as $lot) {
                    $acc += $lot->qty_remaining;
                    if ($startIndex < $acc) {
                        $d = $lot->lot_date->toDateString();
                        if ($cartonDates[$j] === null || $d < $cartonDates[$j]) {
                            $cartonDates[$j] = $d;
                            $cartonCodes[$j] = $lot->lot_code;
                        }
                        break;
                    }
                }
            }
        }

        foreach ($components as $c) {
            $this->deduct($c->component_id, $c->qty_per_box * $cartons, 'pack_used', "Packed into {$box->name}", null, null, null, false, $finishingLogId);
        }

        // one carton lot per (date, code) pair
        $groups = [];
        foreach ($cartonDates as $j => $date) {
            $key = $date . '|' . ($cartonCodes[$j] ?? '');
            $groups[$key] = ($groups[$key] ?? 0) + 1;
        }
        foreach ($groups as $key => $count) {
            [$date, $code] = explode('|', $key, 2);
            $this->receive($box->id, $count, (string) $date, 'production', $finishingLogId, 'Packed cartons', null, null, false, $code !== '' ? $code : null);
        }
    }

    /**
     * Undo a packing log: the pieces go back to the lots they came from and the carton lots disappear.
     * Refused when some of those cartons were already sold or opened.
     */
    public function undoPack(int $finishingLogId): void
    {
        $cartonLots = FinishedGoodsLot::where('finishing_log_id', $finishingLogId)->lockForUpdate()->get();
        foreach ($cartonLots as $lot) {
            if ($lot->qty_remaining < $lot->qty_produced) {
                throw ValidationException::withMessages([
                    'finishing_log' => 'Some cartons from this packing were already sold or opened, so it cannot be deleted. Use Adjust stock instead.',
                ]);
            }
        }

        $used = FinishedGoodsMovement::where('finishing_log_id', $finishingLogId)->where('type', 'pack_used')->get();
        foreach ($used as $m) {
            $back = -$m->quantity;
            $lot = $m->finished_goods_lot_id ? FinishedGoodsLot::lockForUpdate()->find($m->finished_goods_lot_id) : null;
            if ($lot) {
                $lot->qty_remaining = $lot->qty_remaining + $back;
                $lot->save();
                $this->adjustTotal($m->finished_product_id, $back);
                $this->log($m->finished_product_id, $lot->id, 'pack_restored', $back, 'Packing deleted');
            } else {
                $this->receive($m->finished_product_id, $back, now()->toDateString(), 'pack_restored', null, 'Packing deleted');
            }
        }

        foreach ($cartonLots as $lot) {
            $this->log($lot->finished_product_id, $lot->id, 'production_removed', -$lot->qty_remaining, 'Packing deleted');
            $this->adjustTotal($lot->finished_product_id, -$lot->qty_remaining);
            $lot->delete();
        }
    }

    /**
     * Open $count sealed cartons: carton lots go down, the pieces appear as loose lots with the carton's date.
     * Returns how many cartons were really opened (limited by sealed stock).
     */
    public function openBox(FinishedProduct $box, int $count, ?int $orderId = null, ?string $reason = null): int
    {
        $taken = $this->takeFromLots($box->id, $count, 'open_box', $reason, null, $orderId);
        $opened = (int) array_sum(array_column($taken, 'qty'));
        $this->adjustTotal($box->id, -$opened);

        $components = $box->components()->get();
        foreach ($taken as $t) {
            foreach ($components as $c) {
                $this->receive($c->component_id, $t['qty'] * $c->qty_per_box, $t['lot']->lot_date->toDateString(), 'unpack', null, $reason ?? "Opened {$box->name}", $orderId, null, false, $t['lot']->lot_code);
            }
        }

        return $opened;
    }

    /**
     * Order deduction for a piece product that is packed into cartons:
     *  1. whole sealed cartons for the part of the order that fills cartons (oldest first),
     *  2. the rest from loose pieces,
     *  3. a sealed carton is opened only when loose pieces are not enough.
     * Returns [pieces taken from stock, cartons opened].
     */
    public function deductForOrder(int $productId, float $qty, int $orderId, int $orderItemId): array
    {
        $taken = 0.0;
        $opened = 0;
        $link = $this->cartonOf($productId);
        $box = $link && $link->qty_per_box > 0 ? FinishedProduct::find($link->finished_product_id) : null;

        if ($box) {
            $k = (float) $link->qty_per_box;
            $sealed = (int) floor($this->available($box->id));

            $whole = min((int) floor($qty / $k), $sealed);
            if ($whole > 0) {
                // sealed cartons sold as cartons: own movement type so returns/deletes know the unit is cartons
                $this->deduct($box->id, $whole, 'order_sealed', 'Sold as sealed cartons', null, $orderId, $orderItemId);
                $taken += $whole * $k;
                $qty -= $whole * $k;
                $sealed -= $whole;
            }

            $loose = $this->available($productId);
            if ($qty > $loose && $sealed > 0) {
                $opened = $this->openBox($box, min((int) ceil(($qty - $loose) / $k), $sealed), $orderId, 'Opened for order');
            }
        }

        $taken += $this->deduct($productId, $qty, 'order', null, null, $orderId, $orderItemId, true);

        return [$taken, $opened];
    }

    /**
     * Put returned goods back: first into the lots the order item came from, the rest as a new lot dated today.
     */
    public function restoreForOrderItem(int $productId, float $qty, ?int $orderId, ?int $orderItemId, ?string $reason = null): void
    {
        $left = $qty;

        if ($orderItemId) {
            $moves = FinishedGoodsMovement::where('order_item_id', $orderItemId)
                ->whereNotNull('finished_goods_lot_id')
                ->whereIn('type', ['order', 'return'])
                ->get()
                ->groupBy('finished_goods_lot_id');

            foreach ($moves as $lotId => $rows) {
                // order moves are negative, earlier returns positive: -sum = still returnable to this lot
                $returnable = -$rows->sum('quantity');
                $lot = FinishedGoodsLot::lockForUpdate()->find($lotId);
                if (!$lot || $returnable <= 0 || $left <= 0) {
                    continue;
                }
                $put = min($returnable, $left);
                $lot->qty_remaining = $lot->qty_remaining + $put;
                $lot->save();
                $this->adjustTotal($productId, $put);
                $this->log($productId, $lot->id, 'return', $put, $reason, $orderId, $orderItemId);
                $left -= $put;
            }
        }

        if ($left > 0) {
            $this->receive($productId, $left, now()->toDateString(), 'return', null, $reason, $orderId, $orderItemId);
        }
    }

    /**
     * Undo what an order took from finished stock (used when the order is deleted).
     * Per item: put back what lots gave and was not already returned, and give back any oversold part to the total.
     */
    public function restoreForOrder(\App\Models\Order $order): void
    {
        if (($order->document_type ?? 'order') === 'devis') {
            return; // quotes never touched stock
        }

        foreach ($order->items as $item) {
            if (!$item->finished_product_id) {
                continue;
            }

            // sealed cartons sold with this line go back to their lots first
            $sealedPieces = 0.0;
            $carton = $this->cartonOf($item->finished_product_id);
            foreach (FinishedGoodsMovement::where('order_item_id', $item->id)->where('type', 'order_sealed')->get() as $m) {
                $back = -$m->quantity;
                $lot = $m->finished_goods_lot_id ? FinishedGoodsLot::lockForUpdate()->find($m->finished_goods_lot_id) : null;
                if ($lot) {
                    $lot->qty_remaining = $lot->qty_remaining + $back;
                    $lot->save();
                    $this->adjustTotal($m->finished_product_id, $back);
                    $this->log($m->finished_product_id, $lot->id, 'return', $back, 'Order deleted', $order->id);
                } else {
                    $this->receive($m->finished_product_id, $back, now()->toDateString(), 'return', null, 'Order deleted', $order->id);
                }
                $sealedPieces += $back * ($carton?->qty_per_box ?? 0);
            }

            $moves = FinishedGoodsMovement::where('order_item_id', $item->id)->whereIn('type', ['order', 'return'])->get();
            $tookFromLots = -$moves->where('type', 'order')->sum('quantity');
            $stillOut = -$moves->sum('quantity'); // not yet returned to a lot
            $oversold = max(0, (float) $item->quantity - $tookFromLots - $sealedPieces); // total was lowered for this, lots were not

            if ($stillOut > 0) {
                $this->restoreForOrderItem($item->finished_product_id, $stillOut, $order->id, $item->id, 'Order deleted');
            }
            if ($oversold > 0) {
                $this->adjustTotal($item->finished_product_id, $oversold);
            }
        }
    }

    /** Quantity currently sitting in lots for a product. */
    public function available(int $productId): float
    {
        return (float) FinishedGoodsLot::where('finished_product_id', $productId)->sum('qty_remaining');
    }

    public function log(int $productId, ?int $lotId, string $type, float $qty, ?string $reason = null, ?int $orderId = null, ?int $orderItemId = null, ?int $finishingLogId = null): void
    {
        FinishedGoodsMovement::create([
            'finished_product_id'   => $productId,
            'finished_goods_lot_id' => $lotId,
            'type'                  => $type,
            'quantity'              => $qty,
            'reason'                => $reason,
            'order_id'              => $orderId,
            'order_item_id'         => $orderItemId,
            'finishing_log_id'      => $finishingLogId,
            'user_id'               => auth()->id(),
            'created_at'            => now(),
        ]);
    }

    public function adjustTotal(int $productId, float $delta): void
    {
        $stock = FinishedGoodsStock::firstOrCreate(['finished_product_id' => $productId], ['quantity' => 0]);
        $stock->quantity = $stock->quantity + $delta;
        $stock->save();
    }
}
