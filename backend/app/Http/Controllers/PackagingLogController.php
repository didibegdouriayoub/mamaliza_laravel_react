<?php

namespace App\Http\Controllers;

use App\Models\PackagingLog;
use App\Models\PackagingCarton;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PackagingLogController extends Controller
{
    public function index()
    {
        $logs = PackagingLog::with('carton')
            ->where('date', '>=', now()->subDays(30)->toDateString())
            ->orderByDesc('date')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($logs);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'carton_id'     => 'required|exists:packaging_cartons,id',
            'date'          => 'required|date',
            'cartons_count' => 'required|integer|min:0',
            'loose_pieces'  => 'required|integer|min:0',
            'notes'         => 'nullable|string',
        ]);

        DB::transaction(function () use ($validated, &$log) {
            $log = PackagingLog::create($validated);

            // Deduct materials: amount_per_carton × cartons_count
            $carton = PackagingCarton::with('cartonMaterials')->find($validated['carton_id']);
            foreach ($carton->cartonMaterials as $cm) {
                $deduction = $cm->amount_per_carton * $validated['cartons_count'];
                InventoryItem::where('id', $cm->material_id)
                    ->decrement('quantity', $deduction);
            }
        });

        return response()->json($log->load('carton'), 201);
    }

    public function destroy(PackagingLog $packagingLog)
    {
        DB::transaction(function () use ($packagingLog) {
            // Restore materials stock
            $carton = PackagingCarton::with('cartonMaterials')->find($packagingLog->carton_id);
            foreach ($carton->cartonMaterials as $cm) {
                $restoration = $cm->amount_per_carton * $packagingLog->cartons_count;
                InventoryItem::where('id', $cm->material_id)
                    ->increment('quantity', $restoration);
            }

            $packagingLog->delete();
        });

        return response()->json(null, 204);
    }
}
