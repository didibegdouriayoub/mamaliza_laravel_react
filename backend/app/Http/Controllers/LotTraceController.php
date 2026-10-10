<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\FinishedGoodsLot;
use App\Models\FinishedGoodsMovement;
use App\Models\FinishingLog;
use App\Models\InventoryItem;
use App\Models\Order;
use Carbon\Carbon;

/**
 * Traceability for a printed box lot code (e.g. TA260806KRM):
 * production date, the finishing run(s), source batch groups with their ingredients, and the buyers.
 */
class LotTraceController extends Controller
{
    public function show(string $code)
    {
        $code = strtoupper(preg_replace('/\s+/', '', $code));

        if (!preg_match('/^([A-Z]{2})(\d{6})\d*([A-Z]{2,6})$/', $code, $m)) {
            return response()->json(['message' => 'Not a valid lot code (2 letters, 6 digits YYMMDD, product letters).'], 422);
        }

        // Only the first 6 digits are the date
        try {
            $date = Carbon::createFromFormat('ymd', $m[2]);
            $productionDate = $date && $date->format('ymd') === $m[2] ? $date->toDateString() : null;
        } catch (\Throwable $e) {
            $productionDate = null;
        }
        if (!$productionDate) {
            return response()->json(['message' => 'The date inside this lot code is not a real date.'], 422);
        }

        // Match on prefix + the 6 date digits + product letters; extra digits in between are ignored
        $pattern = '^' . $m[1] . $m[2] . '[0-9]*' . $m[3] . '$';

        $logs = FinishingLog::whereRaw('lot_code REGEXP ?', [$pattern])
            ->with(['product:id,name,type', 'operator:id,name', 'batchSources.batchGroup.batches'])
            ->orderBy('date')->orderBy('id')->get();
        $lots = FinishedGoodsLot::whereRaw('lot_code REGEXP ?', [$pattern])->with('product:id,name,type')->get();

        if ($logs->isEmpty() && $lots->isEmpty()) {
            return response()->json([
                'message'         => 'No production found for this lot code.',
                'lot_code'        => $code,
                'production_date' => $productionDate,
            ], 404);
        }

        // Ingredient lot numbers come from the inventory item each batch used
        $materialIds = $logs->flatMap(fn ($l) => $l->batchSources->flatMap(
            fn ($s) => optional($s->batchGroup)->batches?->flatMap(fn (Batch $b) => collect($b->input_materials)->pluck('material_id')) ?? collect()
        ))->filter()->unique()->values();
        $inventoryLots = InventoryItem::whereIn('id', $materialIds)->pluck('lot', 'id');

        $runs = $logs->map(function (FinishingLog $log) use ($inventoryLots) {
            $totalKg = (float) $log->batchSources->sum('kg_used');

            return [
                'id'       => $log->id,
                'date'     => $log->date instanceof Carbon ? $log->date->toDateString() : (string) $log->date,
                'product'  => $log->product?->name,
                'pieces'   => $log->pieces_produced,
                'operator' => $log->operator?->name,
                'sources'  => $log->batchSources->map(function ($src) use ($totalKg, $inventoryLots) {
                    $group = $src->batchGroup;

                    return [
                        'batch_group_id' => $src->batch_group_id,
                        'recipe'         => $group?->recipe_name,
                        'date'           => $group?->batches?->first()?->started_at ? Carbon::parse($group->batches->first()->started_at)->toDateString() : null,
                        'kg_used'        => $src->kg_used,
                        'share_percent'  => $totalKg > 0 ? round($src->kg_used / $totalKg * 100, 1) : null,
                        'batches'        => ($group?->batches ?? collect())->map(fn (Batch $b) => [
                            'id'          => $b->id,
                            'lot'         => $b->lot,
                            'status'      => $b->status,
                            'started_at'  => $b->started_at ? Carbon::parse($b->started_at)->toDateString() : null,
                            'output'      => $b->output_quantity,
                            'output_unit' => $b->output_unit,
                            'ingredients' => collect($b->input_materials)->map(fn ($i) => [
                                'name'     => $i['material_name'] ?? $i['materialName'] ?? '—',
                                'quantity' => $i['quantity'] ?? null,
                                'unit'     => $i['unit'] ?? null,
                                'lot'      => $inventoryLots[$i['material_id'] ?? $i['materialId'] ?? 0] ?? null,
                            ])->values(),
                        ])->values(),
                    ];
                })->values(),
            ];
        })->values();

        // Buyers: orders that took stock from any lot carrying this code (pieces and cartons)
        $moves = FinishedGoodsMovement::whereIn('finished_goods_lot_id', $lots->pluck('id'))
            ->where('type', 'order')->whereNotNull('order_id')->get();
        $orders = Order::with('customer:id,name,phone')->whereIn('id', $moves->pluck('order_id')->unique())->get()->keyBy('id');
        $productNames = $lots->pluck('product.name', 'finished_product_id');

        $buyers = $moves->groupBy('order_id')->map(function ($rows, $orderId) use ($orders, $productNames) {
            $order = $orders[$orderId] ?? null;

            return [
                'order_id' => (int) $orderId,
                'date'     => $order?->created_at?->toDateString(),
                'customer' => $order?->customer?->name ?? $order?->customer_name ?? 'Unknown',
                'phone'    => $order?->customer?->phone,
                'items'    => $rows->groupBy('finished_product_id')->map(fn ($r, $pid) => [
                    'product'  => $productNames[$pid] ?? '—',
                    'quantity' => abs($r->sum('quantity')),
                ])->values(),
            ];
        })->sortBy('date')->values();

        return response()->json([
            'lot_code'        => $code,
            'production_date' => $productionDate,
            'products'        => $lots->pluck('product.name')->merge($logs->pluck('product.name'))->filter()->unique()->values(),
            'runs'            => $runs,
            'buyers'          => $buyers,
            'traceable'       => $runs->isNotEmpty(),
        ]);
    }
}
