<?php

namespace App\Http\Controllers;

use App\Models\FinishingLog;
use App\Models\FinishedGoodsLot;
use App\Services\FinishedStockService;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinishingLogController extends Controller
{
    public function index()
    {
        $logs = FinishingLog::with([
            'product:id,name,type,unit_price',
            'batchSources.batchGroup:id,recipe_id',
            'batchSources.batchGroup.recipe:id,name',
            'operator:id,name',
        ])->latest()->get();

        return response()->json($logs);
    }

    public function store(Request $request, FinishedStockService $stockService)
    {
        $validated = $request->validate([
            'finished_product_id' => 'required|exists:finished_products,id',
            'pieces_produced'     => 'required|integer|min:1',
            'date'                => 'required|date',
            'notes'               => 'nullable|string',
            'batch_sources'       => 'array',
            'batch_sources.*.batch_group_id' => 'required|exists:batch_groups,id',
            'batch_sources.*.kg_used'        => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($validated, $stockService) {
            $log = FinishingLog::create([
                'finished_product_id' => $validated['finished_product_id'],
                'pieces_produced'     => $validated['pieces_produced'],
                'date'                => $validated['date'],
                'notes'               => $validated['notes'] ?? null,
                'operator_id'         => auth()->id(),
            ]);

            // Save batch sources
            foreach ($validated['batch_sources'] ?? [] as $src) {
                $log->batchSources()->create($src);
            }

            $pieces = $validated['pieces_produced'];

            // Deduct packaging materials from inventory
            $product = $log->product()->with('materials')->first();
            foreach ($product->materials as $mat) {
                $toDeduct = $mat->qty_per_piece * $pieces;
                InventoryItem::withoutEvents(function () use ($mat, $toDeduct) {
                    $item = InventoryItem::find($mat->inventory_item_id);
                    if ($item) {
                        $item->quantity = max(0, $item->quantity - $toDeduct);
                        $item->save();
                    }
                });
            }

            // Add to finished goods stock (total) and record the lot (per production date)
            $stockService->receive($product->id, $pieces, $validated['date'], 'production', $log->id);
        });

        return response()->json(['message' => 'Finishing log saved.'], 201);
    }

    public function destroy(FinishingLog $finishingLog, FinishedStockService $stockService)
    {
        DB::transaction(function () use ($finishingLog, $stockService) {
            $pieces = $finishingLog->pieces_produced;
            $product = $finishingLog->product()->with('materials')->first();

            // Restore packaging materials
            foreach ($product->materials as $mat) {
                $toRestore = $mat->qty_per_piece * $pieces;
                InventoryItem::withoutEvents(function () use ($mat, $toRestore) {
                    $item = InventoryItem::find($mat->inventory_item_id);
                    if ($item) {
                        $item->quantity += $toRestore;
                        $item->save();
                    }
                });
            }

            // Remove this log's lot from stock. Only what is still unsold in the lot leaves the total;
            // logs created before lots existed have no lot, so take their pieces from the oldest lots.
            $lot = FinishedGoodsLot::where('finishing_log_id', $finishingLog->id)->lockForUpdate()->first();
            if ($lot) {
                $removed = $lot->qty_remaining;
                $lot->qty_remaining = 0;
                $lot->save();
                $stockService->log($product->id, $lot->id, 'production_removed', -$removed, 'Finishing log deleted');
                $stockService->adjustTotal($product->id, -$removed);
                $lot->delete();
            } else {
                $stockService->deduct($product->id, $pieces, 'production_removed', 'Finishing log deleted');
            }

            $finishingLog->batchSources()->delete();
            $finishingLog->delete();
        });

        return response()->json(null, 204);
    }
}
