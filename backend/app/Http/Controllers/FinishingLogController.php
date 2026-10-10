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
        $request->merge(['lot_code' => $request->filled('lot_code') ? strtoupper(preg_replace('/\s+/', '', $request->input('lot_code'))) : null]);

        $validated = $request->validate([
            'finished_product_id' => 'required|exists:finished_products,id',
            'pieces_produced'     => 'required|integer|min:1',
            'cartons'             => 'nullable|integer|min:0', // piece products: how many cartons to pack (default: the maximum)
            'date'                => 'required|date',
            'notes'               => 'nullable|string',
            // printed box code: 2 letters + YYMMDD (+ more digits) + product letters
            'lot_code'            => ['nullable', 'regex:/^[A-Z]{2}\d{6}\d*[A-Z]{2,6}$/'],
            'batch_sources'       => 'array',
            'batch_sources.*.batch_group_id' => 'required|exists:batch_groups,id',
            'batch_sources.*.kg_used'        => 'required|numeric|min:0',
        ]);

        $product = FinishedProduct::findOrFail($validated['finished_product_id']);
        if ($product->type === 'piece') {
            // a piece lot must be traceable: its code and at least one source batch group
            if (empty($validated['lot_code'])) {
                throw ValidationException::withMessages(['lot_code' => 'Enter the lot code printed on the box.']);
            }
            if (empty($validated['batch_sources'])) {
                throw ValidationException::withMessages(['batch_sources' => 'Select at least one source batch group.']);
            }
        }

        $cartonsPacked = 0;

        DB::transaction(function () use ($validated, $stockService, $product, &$cartonsPacked) {
            $log = $this->createLog(
                $product,
                $validated['pieces_produced'], $validated['date'], $validated['notes'] ?? null,
                $validated['batch_sources'] ?? [], null, $stockService, $validated['lot_code'] ?? null
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
    private function createLog(FinishedProduct $product, int $pieces, string $date, ?string $notes, array $sources, ?int $parentId, FinishedStockService $stockService, ?string $lotCode = null): FinishingLog
    {
        // Cartons carry the lot code of the pieces inside (set per carton lot when packing)
        $log = FinishingLog::create([
            'lot_code'            => $product->type === 'piece' ? $lotCode : null,
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
            $stockService->receive($product->id, $pieces, $date, 'production', $log->id, null, null, null, false, $lotCode);
        }

        return $log->setRelation('product', $product);
    }

    private function deleteLog(FinishingLog $finishingLog, FinishedStockService $stockService): void
    {
        // Trace-only logs made by lots:backfill-codes never touched stock: just remove the record
        if (str_starts_with((string) $finishingLog->notes, \App\Console\Commands\BackfillLotCodes::MARKER)) {
            $finishingLog->batchSources()->delete();
            $finishingLog->delete();
            return;
        }

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
