<?php

namespace App\Http\Controllers;

use App\Models\ProductionLog;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductionLogController extends Controller
{
    public function index()
    {
        return response()->json(ProductionLog::with('leftovers')->latest('logged_at')->latest('id')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'batch_id' => 'nullable|string',
            'recipe_name' => 'nullable|string',
            'operator_id' => 'nullable|string',
            'operator_name' => 'nullable|string',
            'produced_pieces' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string',
            'notes' => 'nullable|string',
            'logged_at' => 'nullable|date',
            'leftovers' => 'nullable|array',
            'leftovers.*.materialName' => 'required|string',
            'leftovers.*.quantity' => 'required|numeric|min:0',
            'leftovers.*.unit' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $log = ProductionLog::create([
                'batch_id' => $validated['batch_id'] ?? null,
                'recipe_name' => $validated['recipe_name'] ?? null,
                'operator_id' => $validated['operator_id'] ?? null,
                'operator_name' => $validated['operator_name'] ?? null,
                'produced_pieces' => $validated['produced_pieces'] ?? 0,
                'unit' => $validated['unit'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'logged_at' => $validated['logged_at'] ?? now()->toDateString(),
            ]);

            if (!empty($validated['leftovers'])) {
                foreach ($validated['leftovers'] as $leftover) {
                    if (empty($leftover['materialName']) || empty($leftover['quantity'])) continue;

                    // 1. Create leftover record
                    $log->leftovers()->create([
                        'item' => $leftover['materialName'],
                        'amount' => $leftover['quantity'],
                        'unit' => $leftover['unit'] ?? '',
                    ]);

                    // 2. Return leftover to stock (find matching inventory item by name)
                     $inventoryItem = InventoryItem::where('name', $leftover['materialName'])->first();
                     if ($inventoryItem) {
                         $inventoryItem->increment('quantity', $leftover['quantity']);
                     }
                }
            }

            DB::commit();
            return response()->json($log->load('leftovers'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to save production log: ' . $e->getMessage()], 400);
        }
    }

    public function show(ProductionLog $productionLog)
    {
        return response()->json($productionLog->load('leftovers'));
    }

    public function update(Request $request, ProductionLog $productionLog)
    {
        // For simplicity and auditability, we won't allow complex updates on leftovers post-creation.
        // Update only metadata.
        $validated = $request->validate([
            'notes' => 'nullable|string',
            'logged_at' => 'nullable|date',
        ]);

        $productionLog->update($validated);
        return response()->json($productionLog->load('leftovers'));
    }

    public function destroy(ProductionLog $productionLog)
    {
        $productionLog->delete();
        return response()->json(null, 204);
    }
}
