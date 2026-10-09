<?php

namespace App\Http\Controllers;

use App\Models\FinishedGoodsLot;
use App\Models\FinishedProduct;
use App\Models\FinishingLog;
use App\Models\InventoryItem;
use App\Services\FinishedStockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
            'cartons'             => 'nullable|integer|min:0', // piece products: how many cartons to pack (default: the maximum)
            'date'                => 'required|date',
            'notes'               => 'nullable|string',
            'batch_sources'       => 'array',
            'batch_sources.*.batch_group_id' => 'required|exists:batch_groups,id',
            'batch_sources.*.kg_used'        => 'required|numeric|min:0',
        ]);

        $cartonsPacked = 0;

        DB::transaction(function () use ($validated, $stockService, &$cartonsPacked) {
            $log = $this->createLog(
                FinishedProduct::findOrFail($validated['finished_product_id']),
                $validated['pieces_produced'], $validated['date'], $validated['notes'] ?? null,
                $validated['batch_sources'] ?? [], null, $stockService
            );

            $product = $log->product;
            if ($product->type !== 'piece') {
                return;
            }

            // Each product has one carton: pack it automatically (only for a carton holding this product alone)
            $link = $stockService->cartonOf($product->id);
            $box = $link ? FinishedProduct::find($link->finished_product_id) : null;
            if (!$box || $link->qty_per_box <= 0 || $box->components()->count() !== 1) {
                return;
            }

            $max = (int) floor($validated['pieces_produced'] / $link->qty_per_box);
            $cartons = $validated['cartons'] ?? $max;
            if ($cartons > $max) {
                throw ValidationException::withMessages(['cartons' => "Only {$max} carton(s) of {$link->qty_per_box} fit in {$validated['pieces_produced']} pieces."]);
            }
            if ($cartons > 0) {
                $this->createLog($box, $cartons, $validated['date'], "Auto-packed from production #{$log->id}", [], $log->id, $stockService);
                $cartonsPacked = $cartons;
            }
        });

        return response()->json(['message' => 'Finishing log saved.', 'cartons_packed' => $cartonsPacked], 201);
    }

    public function destroy(FinishingLog $finishingLog, FinishedStockService $stockService)
    {
        DB::transaction(fn () => $this->deleteLog($finishingLog, $stockService));

        return response()->json(null, 204);
    }

    /** One production / packing entry: log row, packaging items, and the stock (a lot, or packed cartons). */
    private function createLog(FinishedProduct $product, int $pieces, string $date, ?string $notes, array $sources, ?int $parentId, FinishedStockService $stockService): FinishingLog
    {
        $log = FinishingLog::create([
            'finished_product_id' => $product->id,
            'pieces_produced'     => $pieces,
            'date'                => $date,
            'notes'               => $notes,
            'parent_id'           => $parentId,
            'operator_id'         => auth()->id(),
        ]);

        foreach ($sources as $src) {
            $log->batchSources()->create($src);
        }

        // Deduct packaging materials (per piece, or per carton for a box)
        foreach ($product->materials()->get() as $mat) {
            $toDeduct = $mat->qty_per_piece * $pieces;
            InventoryItem::withoutEvents(function () use ($mat, $toDeduct) {
                $item = InventoryItem::find($mat->inventory_item_id);
                if ($item) {
                    $item->quantity = max(0, $item->quantity - $toDeduct);
                    $item->save();
                }
            });
        }

        if ($product->type === 'box') {
            // Packing cartons: uses the pieces inside (422 when not enough), lots inherit the pieces' dates
            $stockService->pack($product, $pieces, $log->id);
        } else {
            $stockService->receive($product->id, $pieces, $date, 'production', $log->id);
        }

        return $log->setRelation('product', $product);
    }

    private function deleteLog(FinishingLog $finishingLog, FinishedStockService $stockService): void
    {
        // Cartons packed automatically from this production go first (their pieces return to stock)
        foreach (FinishingLog::where('parent_id', $finishingLog->id)->get() as $child) {
            $this->deleteLog($child, $stockService);
        }

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

        if ($product->type === 'box') {
            $stockService->undoPack($finishingLog->id);
        } else {
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
        }

        $finishingLog->batchSources()->delete();
        $finishingLog->delete();
    }
}
