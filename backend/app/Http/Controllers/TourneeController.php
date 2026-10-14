<?php

namespace App\Http\Controllers;

use App\Models\FinishedGoodsLot;
use App\Models\FinishedProduct;
use App\Models\Order;
use App\Models\Tournee;
use App\Models\TourneeDelivery;
use App\Models\TourneeItem;
use App\Services\DocumentNumberService;
use App\Services\FinishedStockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A worker's daily load. Load: stock leaves the fridge lot by lot. Settle: each customer's facture is taken
 * from that load (no second stock deduction). Close: what is left comes back to the same lots.
 */
class TourneeController extends Controller
{
    public function index()
    {
        $tournees = Tournee::with(['items.product:id,name', 'items.lot:id,lot_code,lot_date', 'items.deliveries'])
            ->latest('date')->latest('id')->limit(100)->get();

        return response()->json($tournees->map(fn ($t) => $this->present($t)));
    }

    public function show(Tournee $tournee)
    {
        return response()->json($this->present($tournee));
    }

    /** Morning load: [{lot_id, qty}, ...] leaves the fridge. */
    public function store(Request $request, FinishedStockService $stock)
    {
        $validated = $request->validate([
            'worker_name'     => 'required|string|max:255',
            'date'            => 'required|date',
            'notes'           => 'nullable|string',
            'items'           => 'required|array|min:1',
            'items.*.lot_id'  => 'required|integer|exists:finished_goods_lots,id',
            'items.*.qty'     => 'required|numeric|gt:0',
        ]);

        $wanted = [];
        foreach ($validated['items'] as $i) {
            $wanted[(int) $i['lot_id']] = ($wanted[(int) $i['lot_id']] ?? 0) + (float) $i['qty'];
        }

        $tournee = DB::transaction(function () use ($validated, $wanted, $stock) {
            $tournee = Tournee::create([
                'worker_name' => trim($validated['worker_name']),
                'date'        => $validated['date'],
                'notes'       => $validated['notes'] ?? null,
                'created_by'  => auth()->id(),
            ]);

            $lots = FinishedGoodsLot::whereIn('id', array_keys($wanted))->lockForUpdate()->get()->keyBy('id');
            foreach ($wanted as $lotId => $qty) {
                $lot = $lots->get($lotId);
                if ($qty > $lot->qty_remaining + 1e-9) {
                    throw ValidationException::withMessages(['items' => "Lot {$lot->lot_code} only has {$lot->qty_remaining} left, {$qty} requested."]);
                }
                $lot->qty_remaining = $lot->qty_remaining - $qty;
                $lot->save();
                $stock->adjustTotal($lot->finished_product_id, -$qty);
                $stock->log($lot->finished_product_id, $lot->id, 'tournee_out', -$qty, "Tournée {$tournee->worker_name} #{$tournee->id}");

                $tournee->items()->create([
                    'finished_product_id'   => $lot->finished_product_id,
                    'finished_goods_lot_id' => $lot->id,
                    'qty_loaded'            => $qty,
                ]);
            }

            return $tournee;
        });

        return response()->json($this->present($tournee->fresh()), 201);
    }

    /** Evening: one customer's facture, taken from what the worker still carries (oldest lot first). */
    public function settle(Request $request, Tournee $tournee, DocumentNumberService $numbers)
    {
        if ($tournee->status !== 'open') {
            throw ValidationException::withMessages(['tournee' => 'This tournée is closed.']);
        }
        $validated = $request->validate([
            'customer_id'                  => 'nullable|exists:customers,id',
            'customer_name'                => 'required|string|max:255',
            'paid_in_full'                 => 'nullable|boolean',
            'items'                        => 'required|array|min:1',
            'items.*.finished_product_id'  => 'required|exists:finished_products,id',
            'items.*.quantity'             => 'required|numeric|gt:0',
            'items.*.unit_price'           => 'nullable|numeric|min:0',
        ]);

        $order = DB::transaction(function () use ($validated, $tournee, $numbers) {
            $items = $tournee->items()->with(['lot:id,lot_date', 'deliveries'])->lockForUpdate()->get();
            $remaining = $items->mapWithKeys(fn ($i) => [$i->id => $i->remaining()])->all();
            $money = \App\Support\Money::visible();

            $order = Order::create([
                'customer_id'     => $validated['customer_id'] ?? null,
                'customer_name'   => trim($validated['customer_name']),
                'total_amount'    => 0,
                'amount_paid'     => 0,
                'amount_returned' => 0,
                'status'          => 'pending',
                'document_type'   => 'facture',
                'doc_number'      => $numbers->next('facture'),
                'tournee_id'      => $tournee->id,
            ]);

            $total = 0.0;
            foreach ($validated['items'] as $line) {
                $product = FinishedProduct::findOrFail($line['finished_product_id']);
                $qty = (float) $line['quantity'];
                $price = $money && isset($line['unit_price']) ? (float) $line['unit_price'] : (float) $product->unit_price;

                // oldest lot first, from this tournée's own remainder
                $pool = $items->where('finished_product_id', $product->id)
                    ->sortBy(fn ($i) => [$i->lot && $i->lot->lot_date ? $i->lot->lot_date->toDateString() : '', $i->id]);
                $available = $pool->sum(fn ($i) => max(0, $remaining[$i->id]));
                if ($qty > $available + 1e-9) {
                    throw ValidationException::withMessages(['items' => "{$product->name}: only {$available} left with the worker, {$qty} requested."]);
                }

                $orderItem = $order->items()->create([
                    'product_name'        => $product->name,
                    'finished_product_id' => $product->id,
                    'quantity'            => $qty,
                    'unit_price'          => $price,
                    'total'               => round($price * $qty, 2),
                ]);
                $total += $orderItem->total;

                $left = $qty;
                foreach ($pool as $item) {
                    if ($left <= 1e-9) {
                        break;
                    }
                    $take = min($left, max(0, $remaining[$item->id]));
                    if ($take <= 0) {
                        continue;
                    }
                    TourneeDelivery::create(['tournee_item_id' => $item->id, 'order_id' => $order->id, 'order_item_id' => $orderItem->id, 'qty' => $take]);
                    $remaining[$item->id] -= $take;
                    $left -= $take;
                }
            }

            $total = round($total, 2);
            $paid = $money && !empty($validated['paid_in_full']);
            $order->update([
                'total_amount' => $total,
                'amount_paid'  => $paid ? $total : 0,
                'status'       => $paid ? 'paid' : 'pending',
                'paid_at'      => $paid ? now() : null,
            ]);

            return $order;
        });

        return response()->json($order->load('items'), 201);
    }

    /** End of day: the rest comes back to its lots. `returns` [{item_id, qty}] may bring back less (the gap is "missing"). */
    public function close(Request $request, Tournee $tournee, FinishedStockService $stock)
    {
        if ($tournee->status !== 'open') {
            throw ValidationException::withMessages(['tournee' => 'This tournée is already closed.']);
        }
        $validated = $request->validate([
            'returns'            => 'nullable|array',
            'returns.*.item_id'  => 'required|integer',
            'returns.*.qty'      => 'required|numeric|min:0',
        ]);
        $given = collect($validated['returns'] ?? [])->mapWithKeys(fn ($r) => [(int) $r['item_id'] => (float) $r['qty']]);

        DB::transaction(function () use ($tournee, $given, $stock) {
            foreach ($tournee->items()->with('deliveries')->lockForUpdate()->get() as $item) {
                $left = $item->remaining();
                $back = max(0, min($left, $given->has($item->id) ? $given[$item->id] : $left));
                $this->putBack($item, $back, $stock);
                $item->update(['qty_returned' => $item->qty_returned + $back, 'qty_lost' => $item->qty_lost + ($left - $back)]);
            }
            $tournee->update(['status' => 'closed', 'closed_at' => now()]);
        });

        return response()->json($this->present($tournee->fresh()));
    }

    /** Cancel a load nothing was delivered from: everything goes back to the fridge. */
    public function destroy(Tournee $tournee, FinishedStockService $stock)
    {
        if ($tournee->status !== 'open' || TourneeDelivery::whereIn('tournee_item_id', $tournee->items()->pluck('id'))->exists()) {
            throw ValidationException::withMessages(['tournee' => 'Only an open tournée with no delivery can be cancelled. Close it instead.']);
        }

        DB::transaction(function () use ($tournee, $stock) {
            foreach ($tournee->items()->lockForUpdate()->get() as $item) {
                $this->putBack($item, $item->remaining(), $stock);
            }
            $tournee->delete();
        });

        return response()->json(null, 204);
    }

    /** Return $qty of an item to the fridge: its own lot, or a new lot of today when that lot is gone. */
    private function putBack(TourneeItem $item, float $qty, FinishedStockService $stock): void
    {
        if ($qty <= 0) {
            return;
        }
        $lot = $item->finished_goods_lot_id ? FinishedGoodsLot::lockForUpdate()->find($item->finished_goods_lot_id) : null;
        if ($lot) {
            $lot->qty_remaining = $lot->qty_remaining + $qty;
            $lot->save();
            $stock->adjustTotal($item->finished_product_id, $qty);
            $stock->log($item->finished_product_id, $lot->id, 'tournee_return', $qty, 'Back from tournée');
        } else {
            $stock->receive($item->finished_product_id, $qty, now()->toDateString(), 'tournee_return', null, 'Back from tournée');
        }
    }

    private function present(Tournee $t): array
    {
        $t->loadMissing(['items.product:id,name', 'items.lot:id,lot_code,lot_date', 'items.deliveries']);

        $items = $t->items->map(fn (TourneeItem $i) => [
            'id'                  => $i->id,
            'finished_product_id' => $i->finished_product_id,
            'product_name'        => $i->product ? $i->product->name : null,
            'lot_id'              => $i->finished_goods_lot_id,
            'lot_code'            => $i->lot ? $i->lot->lot_code : null,
            'lot_date'            => $i->lot && $i->lot->lot_date ? $i->lot->lot_date->toDateString() : null,
            'qty_loaded'          => $i->qty_loaded,
            'qty_delivered'       => round((float) $i->deliveries->sum('qty'), 4),
            'qty_returned'        => $i->qty_returned,
            'qty_lost'            => $i->qty_lost,
            'qty_remaining'       => $i->remaining(),
        ])->values();

        return [
            'id'          => $t->id,
            'worker_name' => $t->worker_name,
            'date'        => $t->date->toDateString(),
            'status'      => $t->status,
            'notes'       => $t->notes,
            'closed_at'   => $t->closed_at,
            'items'       => $items,
            'orders'      => $t->orders()->with('items')->orderBy('id')->get(),
        ];
    }
}
