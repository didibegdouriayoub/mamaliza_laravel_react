<?php

namespace App\Http\Controllers;

use App\Models\FinishedGoodsLot;
use App\Models\FinishedGoodsMovement;
use App\Models\FinishedProduct;
use App\Services\FinishedStockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinishedStockController extends Controller
{
    // Lots still in the fridge (oldest first) + the latest movements for one product.
    public function show(FinishedProduct $finishedProduct)
    {
        $movements = FinishedGoodsMovement::where('finished_product_id', $finishedProduct->id)
            ->with(['user:id,name', 'lot:id,lot_date'])
            ->orderByDesc('id')->limit(50)->get();

        return response()->json([
            'lots'      => $finishedProduct->availableLots()->get(),
            'movements' => $movements,
        ]);
    }

    // Manual add (new lot) or remove (FIFO, or a chosen lot). Admin only, and a reason is mandatory.
    public function adjust(Request $request, FinishedProduct $finishedProduct, FinishedStockService $stock)
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Only an admin can adjust stock manually.');

        $validated = $request->validate([
            'direction' => 'required|in:add,remove',
            'quantity'  => 'required|numeric|min:0.001',
            'reason'    => 'required|string|min:3|max:255',
            'lot_id'    => 'nullable|integer|exists:finished_goods_lots,id',
            'lot_date'  => 'nullable|date',
        ]);

        $qty = (float) $validated['quantity'];

        DB::transaction(function () use ($validated, $qty, $finishedProduct, $stock) {
            if ($validated['direction'] === 'add') {
                $stock->receive(
                    $finishedProduct->id, $qty, $validated['lot_date'] ?? now()->toDateString(),
                    'adjustment', null, $validated['reason']
                );
                return;
            }

            $lotId = $validated['lot_id'] ?? null;
            if ($lotId && !FinishedGoodsLot::where('id', $lotId)->where('finished_product_id', $finishedProduct->id)->exists()) {
                abort(422, 'That lot does not belong to this product.');
            }

            $available = $lotId
                ? (float) FinishedGoodsLot::find($lotId)->qty_remaining
                : $stock->available($finishedProduct->id);
            if ($qty > $available) {
                abort(422, "Only {$available} available" . ($lotId ? ' in that lot.' : '.'));
            }

            $stock->deduct($finishedProduct->id, $qty, 'adjustment', $validated['reason'], $lotId);
        });

        return $this->show($finishedProduct);
    }
}
