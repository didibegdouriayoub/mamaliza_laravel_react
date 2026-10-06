<?php

namespace App\Services;

use App\Models\FinishedGoodsLot;
use App\Models\FinishedGoodsMovement;
use App\Models\FinishedGoodsStock;

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
    ): FinishedGoodsLot {
        $lot = FinishedGoodsLot::create([
            'finished_product_id' => $productId,
            'finishing_log_id'    => $finishingLogId,
            'lot_date'            => $date,
            'qty_produced'        => $qty,
            'qty_remaining'       => $qty,
            'is_opening'          => $isOpening,
        ]);

        $this->adjustTotal($productId, $qty);
        $this->log($productId, $lot->id, $type, $qty, $reason, $orderId, $orderItemId);

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
    ): float {
        $lots = FinishedGoodsLot::where('finished_product_id', $productId)
            ->where('qty_remaining', '>', 0)
            ->when($lotId, fn ($q) => $q->where('id', $lotId))
            ->orderBy('lot_date')->orderBy('id')
            ->lockForUpdate()->get();

        $left = $qty;
        $taken = 0.0;
        foreach ($lots as $lot) {
            if ($left <= 0) {
                break;
            }
            $take = min($lot->qty_remaining, $left);
            $lot->qty_remaining = $lot->qty_remaining - $take;
            $lot->save();
            $this->log($productId, $lot->id, $type, -$take, $reason, $orderId, $orderItemId);
            $left -= $take;
            $taken += $take;
        }

        $this->adjustTotal($productId, -($allowOversell ? $qty : $taken));

        return $taken;
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

            $moves = FinishedGoodsMovement::where('order_item_id', $item->id)->whereIn('type', ['order', 'return'])->get();
            $tookFromLots = -$moves->where('type', 'order')->sum('quantity');
            $stillOut = -$moves->sum('quantity'); // not yet returned to a lot
            $oversold = max(0, (float) $item->quantity - $tookFromLots); // total was lowered for this, lots were not

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

    public function log(int $productId, ?int $lotId, string $type, float $qty, ?string $reason = null, ?int $orderId = null, ?int $orderItemId = null): void
    {
        FinishedGoodsMovement::create([
            'finished_product_id'   => $productId,
            'finished_goods_lot_id' => $lotId,
            'type'                  => $type,
            'quantity'              => $qty,
            'reason'                => $reason,
            'order_id'              => $orderId,
            'order_item_id'         => $orderItemId,
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
